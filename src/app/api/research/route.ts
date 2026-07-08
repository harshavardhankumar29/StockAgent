import { NextRequest } from "next/server";
import { buildInvestmentGraph } from "@/lib/agent/graph";
import { HumanMessage } from "@langchain/core/messages";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";

export const maxDuration = 300; // 5 minutes max (rate limit retries take time)

// Robust helper to clean and parse JSON from LLM responses
function cleanAndParseJSON(raw: string) {
  let cleaned = raw.trim();

  // Strip Markdown wrappers if they exist
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  // Find first { and last }
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("No JSON boundaries found");
  }
  cleaned = cleaned.substring(startIdx, endIdx + 1);

  // Normalize control characters inside string properties
  let escaped = "";
  let inString = false;
  let isEscaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '"' && !isEscaped) {
      inString = !inString;
    }
    if (inString) {
      if (char === '\n') {
        escaped += "\\n";
      } else if (char === '\r') {
        escaped += "\\r";
      } else if (char === '\t') {
        escaped += "\\t";
      } else {
        escaped += char;
      }
    } else {
      escaped += char;
    }
    
    if (char === '\\' && !isEscaped) {
      isEscaped = true;
    } else {
      isEscaped = false;
    }
  }

  // Fix trailing commas in objects and arrays
  const cleanedJson = escaped
    .replace(/,\s*}/g, '}')
    .replace(/,\s*\]/g, ']');

  return JSON.parse(cleanedJson);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { companyName } = await request.json();

  if (!companyName) {
    return new Response(JSON.stringify({ error: "Company name required" }), {
      status: 400,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: Record<string, unknown>) => {
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream may already be closed
        }
      };

      try {
        sendEvent("start", {
          message: `Starting research on ${companyName}...`,
          timestamp: new Date().toISOString(),
        });

        const graph = buildInvestmentGraph();

        const stepMessages: Record<string, string> = {
          identify_company: "🔍 Identifying company and ticker symbol...",
          financial_research: "📊 Analyzing financial data...",
          news_research: "📰 Researching recent news...",
          competitive_analysis: "⚔️ Analyzing competitive landscape...",
          risk_assessment: "⚠️ Assessing risks...",
          decision: "🧠 Making investment decision...",
        };

        const eventStream = graph.streamEvents(
          {
            messages: [
              new HumanMessage(`Research ${companyName} as an investment opportunity`),
            ],
            companyName,
            ticker: "",
            researchPhase: "",
            companyInfo: "",
            financialSummary: "",
            newsSummary: "",
            competitiveAnalysis: "",
            riskAnalysis: "",
            finalDecision: "",
            isComplete: false,
          },
          { version: "v2" }
        );

        const completedNodes = new Set<string>();

        for await (const event of eventStream) {
          // Track node starts
          if (event.event === "on_chain_start" && stepMessages[event.name]) {
            sendEvent("progress", {
              step: event.name,
              message: stepMessages[event.name],
              status: "running",
            });
          }

          // Track node completions
          if (event.event === "on_chain_end" && stepMessages[event.name]) {
            if (!completedNodes.has(event.name)) {
              completedNodes.add(event.name);
              sendEvent("progress", {
                step: event.name,
                message: stepMessages[event.name],
                status: "complete",
              });
            }

             // Check for final decision
            if (event.name === "decision" && event.data?.output?.finalDecision) {
              const raw = event.data.output.finalDecision;
              console.log("🤖 Raw Agent Decision Output:\n", raw);
              try {
                const decision = cleanAndParseJSON(raw);

                // Save to SQLite database first
                let savedId: string | undefined = undefined;
                try {
                  const savedRecord = await prisma.researchHistory.create({
                    data: {
                      userId,
                      companyName: decision.companyName || companyName,
                      ticker: decision.ticker || "",
                      decision: decision.decision || "AVOID",
                      confidenceScore: decision.confidenceScore || 0,
                      reasoning: decision.reasoning || "",
                      keyMetrics: JSON.stringify(decision.keyMetrics || {}),
                      bullPoints: JSON.stringify(decision.bullPoints || []),
                      bearPoints: JSON.stringify(decision.bearPoints || []),
                      financialHealth: decision.financialHealth || null,
                      moatStrength: decision.moatStrength || null,
                      growthProspects: decision.growthProspects || null,
                      riskLevel: decision.riskLevel || null,
                      timeHorizon: decision.timeHorizon || null,
                    }
                  });
                  savedId = savedRecord.id;
                  console.log("💾 Saved research history to SQLite database:", savedId);
                } catch (dbError) {
                  console.error("❌ Failed to save research history to database:", dbError);
                }

                // Send decision to client, including the saved database ID
                sendEvent("decision", {
                  ...decision,
                  id: savedId,
                });
              } catch (parseError) {
                console.error("❌ Failed to parse decision JSON:", parseError);
                sendEvent("error", { message: "Failed to parse investment decision" });
              }
            }
          }

          // Stream LLM tokens for live feedback
          if (event.event === "on_chat_model_stream") {
            const chunk = event.data?.chunk;
            if (chunk?.content) {
              sendEvent("token", { content: chunk.content });
            }
          }
        }

        sendEvent("complete", { message: "Research complete!" });
        controller.close();
      } catch (error: unknown) {
        console.error("❌ Research pipeline error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Research failed";
        sendEvent("error", { message: errorMessage });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
