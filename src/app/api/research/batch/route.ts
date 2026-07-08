import { NextRequest } from "next/server";
import { buildInvestmentGraph } from "@/lib/agent/graph";
import { HumanMessage } from "@langchain/core/messages";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limiting (count as 1 batch request, but we enforce limit)
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
        },
      }
    );
  }

  const { companies } = await request.json();

  if (!companies || !Array.isArray(companies) || companies.length === 0) {
    return new Response(JSON.stringify({ error: "Companies array is required" }), {
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
          // Stream closed
        }
      };

      try {
        sendEvent("start", {
          message: `Starting batch research on ${companies.join(", ")}...`,
          companies,
          timestamp: new Date().toISOString(),
        });

        const graph = buildInvestmentGraph();

        const stepMessages: Record<string, string> = {
          load_context: "📂 Loading file context...",
          identify_company: "🔍 Identifying company and ticker symbol...",
          financial_research: "📊 Analyzing financial data...",
          news_research: "📰 Researching recent news...",
          competitive_analysis: "⚔️ Analyzing competitive landscape...",
          risk_assessment: "⚠️ Assessing risks...",
          devil_critique: "😈 Conducting Devil's Advocate critique...",
          decision: "🧠 Making investment decision...",
        };

        const completedReportIds: string[] = [];

        // Run companies sequentially to prevent rate limits
        for (const company of companies) {
          try {
            sendEvent("company_start", {
              company,
              message: `Starting analysis for ${company}...`
            });

            const eventStream = graph.streamEvents(
              {
                messages: [
                  new HumanMessage(`Research ${company} as an investment opportunity`),
                ],
                companyName: company,
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
                uploadedContextId: "",
                uploadedContextText: "",
                finalDecision: "",
                isComplete: false,
              },
              { version: "v2" }
            );

            const completedNodes = new Set<string>();

            for await (const event of eventStream) {
              // Stream node starts
              if (event.event === "on_chain_start" && stepMessages[event.name]) {
                sendEvent("progress", {
                  company,
                  step: event.name,
                  message: stepMessages[event.name],
                  status: "running",
                });
              }

              // Stream node completions
              if (event.event === "on_chain_end" && stepMessages[event.name]) {
                if (!completedNodes.has(event.name)) {
                  completedNodes.add(event.name);
                  sendEvent("progress", {
                    company,
                    step: event.name,
                    message: stepMessages[event.name],
                    status: "complete",
                  });
                }

                // Capture final decision and save to database
                if (event.name === "decision" && event.data?.output?.finalDecision) {
                  const raw = event.data.output.finalDecision;
                  try {
                    const decision = JSON.parse(raw);
                    const savedRecord = await prisma.researchHistory.create({
                      data: {
                        userId,
                        companyName: decision.companyName || company,
                        ticker: decision.ticker || "",
                        decision: decision.decision || "PASS",
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
                        chartData: decision.chartData || null,
                        competitorMetrics: decision.competitorMetrics || null,
                        critique: decision.critique || null,
                      },
                    });

                    completedReportIds.push(savedRecord.id);

                    sendEvent("company_decision", {
                      company,
                      reportId: savedRecord.id,
                      decision: decision.decision,
                      confidenceScore: decision.confidenceScore,
                      ticker: decision.ticker,
                      reasoning: decision.reasoning
                    });

                  } catch (parseErr) {
                    console.error(`❌ Parse error for ${company}:`, parseErr);
                  }
                }
              }
            }

            sendEvent("company_complete", {
              company,
              message: `Research complete for ${company}!`
            });

            // Small cooldown between LLM calls to prevent rate limits
            await new Promise(r => setTimeout(r, 2000));

          } catch (companyError: any) {
            console.error(`❌ Failed research for ${company}:`, companyError);
            sendEvent("company_error", {
              company,
              message: companyError.message || `Failed to research ${company}`
            });
          }
        }

        sendEvent("complete", {
          message: "All batch research complete!",
          reportIds: completedReportIds
        });
        controller.close();
      } catch (error: any) {
        console.error("❌ Batch research pipeline error:", error);
        sendEvent("error", { message: error.message || "Batch research pipeline failed" });
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
