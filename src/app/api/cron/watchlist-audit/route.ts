import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { buildInvestmentGraph } from "@/lib/agent/graph";
import { HumanMessage } from "@langchain/core/messages";

export const maxDuration = 300; // 5 minutes max

// GET /api/cron/watchlist-audit — Audit all watchlisted stocks
// Secure this with a CRON_SECRET or secret query param
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    // Simple security gate
    const expectedSecret = process.env.CRON_SECRET || "local_dev_cron_secret";
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const watchlist = await prisma.watchlist.findMany();
    if (watchlist.length === 0) {
      return NextResponse.json({ message: "No watchlisted items to audit." });
    }

    console.log(`⏱️ Watchlist Audit started for ${watchlist.length} stocks...`);
    const results = [];

    const graph = buildInvestmentGraph();

    for (const item of watchlist) {
      try {
        console.log(`🔍 Auditing watchlisted ticker: ${item.ticker} (${item.companyName})...`);

        // Run research graph synchronously
        const output = await graph.invoke({
          messages: [
            new HumanMessage(`Research ${item.companyName} as an investment opportunity`),
          ],
          companyName: item.companyName,
          ticker: item.ticker,
          researchPhase: "",
          companyInfo: "",
          rawFinancials: "",
          financialSummary: "",
          newsSummary: "",
          competitiveAnalysis: "",
          riskAnalysis: "",
          finalDecision: "",
          isComplete: false,
          chartData: "",
          competitorMetrics: "",
          critique: ""
        });

        if (output.finalDecision) {
          const decision = JSON.parse(output.finalDecision);
          
          // Save updated research history
          const savedRecord = await prisma.researchHistory.create({
            data: {
              userId: item.userId,
              companyName: item.companyName,
              ticker: item.ticker,
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
            }
          });

          results.push({
            ticker: item.ticker,
            decision: decision.decision,
            confidenceScore: decision.confidenceScore,
            historyId: savedRecord.id,
            status: "success"
          });
        }
      } catch (err: any) {
        console.error(`❌ Failed to audit ${item.ticker}:`, err);
        results.push({
          ticker: item.ticker,
          status: "failed",
          error: err.message
        });
      }
    }

    return NextResponse.json({
      message: "Watchlist audit completed.",
      processed: results.length,
      results
    });
  } catch (error: any) {
    console.error("❌ Cron watchlist audit failed:", error);
    return NextResponse.json({ error: "Watchlist audit failed: " + error.message }, { status: 500 });
  }
}
