import { NextRequest } from "next/server";
import { buildInvestmentGraph } from "@/lib/agent/graph";
import { HumanMessage } from "@langchain/core/messages";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const maxDuration = 300; // 5 minutes max
// TODO: For production, move long research jobs to a background queue
// (e.g. Inngest, BullMQ) instead of holding an HTTP connection open.
// Vercel Hobby plan caps function duration well under 300s.

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Per-user rate limiting (issue #6)
  const { allowed, remaining, retryAfterMs } = checkRateLimit(userId);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return new Response(
      JSON.stringify({
        error: "Too many research requests. Please try again later.",
        retryAfterSeconds: retryAfterSec,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  }

  const { companyName, uploadedContextId } = await request.json();

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
          devil_critique: "😈 Conducting Devil's Advocate critique...",
          decision: "🧠 Making investment decision...",
        };


        const eventStream = graph.streamEvents(
          {
            messages: [
              new HumanMessage(
                `Research ${companyName} as an investment opportunity`
              ),
            ],
            companyName,
            ticker: "",
            researchPhase: "",
            companyInfo: "",
            rawFinancials: "",
            financialSummary: "",
            newsSummary: "",
            competitiveAnalysis: "",
            riskAnalysis: "",
            chartData: "",
            competitorMetrics: "",
            critique: "",
            uploadedContextId: uploadedContextId || "",
            uploadedContextText: "",
            finalDecision: "",
            isComplete: false,
          },
          { version: "v2" }
        );

        const completedNodes = new Set<string>();

        for await (const event of eventStream) {
          // Track node starts
          if (
            event.event === "on_chain_start" &&
            stepMessages[event.name]
          ) {
            sendEvent("progress", {
              step: event.name,
              message: stepMessages[event.name],
              status: "running",
            });
          }

          // Track node completions
          if (
            event.event === "on_chain_end" &&
            stepMessages[event.name]
          ) {
            if (!completedNodes.has(event.name)) {
              completedNodes.add(event.name);
              sendEvent("progress", {
                step: event.name,
                message: stepMessages[event.name],
                status: "complete",
              });
            }

            // Check for final decision — already parsed JSON (issue #2: no more cleanAndParseJSON)
            if (
              event.name === "decision" &&
              event.data?.output?.finalDecision
            ) {
              const raw = event.data.output.finalDecision;
              console.log("🤖 Raw Agent Decision Output:\n", raw);
              try {
                const decision = JSON.parse(raw);

                // Save to database
                let savedId: string | undefined = undefined;
                try {
                  const savedRecord =
                    await prisma.researchHistory.create({
                      data: {
                        userId,
                        companyName:
                          decision.companyName || companyName,
                        ticker: decision.ticker || "",
                        decision: decision.decision || "PASS",
                        confidenceScore:
                          decision.confidenceScore || 0,
                        reasoning: decision.reasoning || "",
                        keyMetrics: JSON.stringify(
                          decision.keyMetrics || {}
                        ),
                        bullPoints: JSON.stringify(
                          decision.bullPoints || []
                        ),
                        bearPoints: JSON.stringify(
                          decision.bearPoints || []
                        ),
                        financialHealth:
                          decision.financialHealth || null,
                        moatStrength:
                          decision.moatStrength || null,
                        growthProspects:
                          decision.growthProspects || null,
                        riskLevel: decision.riskLevel || null,
                        timeHorizon:
                          decision.timeHorizon || null,
                        chartData: decision.chartData || null,
                        competitorMetrics: decision.competitorMetrics || null,
                        critique: decision.critique || null,
                        uploadedContextId: uploadedContextId || null,
                      },
                    });

                  savedId = savedRecord.id;
                  console.log(
                    "💾 Saved research history to database:",
                    savedId
                  );
                } catch (dbError) {
                  console.error(
                    "❌ Failed to save research history:",
                    dbError
                  );
                }

                // Send decision to client
                sendEvent("decision", {
                  ...decision,
                  id: savedId,
                });
              } catch (parseError) {
                console.error(
                  "❌ Failed to parse decision JSON:",
                  parseError
                );
                sendEvent("error", {
                  message: "Failed to parse investment decision",
                });
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
