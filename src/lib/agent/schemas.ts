import { z } from "zod/v4";

// ─────────────────────────────────────────────
// Zod schema for the LLM's qualitative decision output
// Used with .withStructuredOutput() — the LLM only fills these fields.
// keyMetrics are injected programmatically from raw financial data.
// ─────────────────────────────────────────────
export const QualitativeDecisionSchema = z.object({
  decision: z.enum(["INVEST", "PASS"]).describe("Final investment verdict"),
  confidenceScore: z
    .number()
    .min(55)
    .max(95)
    .describe("Confidence in the decision, 55-95"),
  reasoning: z
    .string()
    .describe("2-3 sentences explaining the investment decision"),
  bullPoints: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Key reasons to invest"),
  bearPoints: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Key risks or reasons to avoid"),
  financialHealth: z
    .enum(["Excellent", "Good", "Fair", "Poor"])
    .describe("Overall financial health assessment"),
  moatStrength: z
    .enum(["Wide", "Narrow", "None"])
    .describe("Competitive moat strength"),
  growthProspects: z
    .enum(["High", "Moderate", "Low"])
    .describe("Growth outlook"),
  riskLevel: z
    .enum(["Low", "Medium", "High"])
    .describe("Overall investment risk level"),
  timeHorizon: z
    .enum(["Short-term", "Medium-term", "Long-term"])
    .describe("Recommended holding period"),
});

export type QualitativeDecision = z.infer<typeof QualitativeDecisionSchema>;

// ─────────────────────────────────────────────
// Full decision type (qualitative + programmatic metrics)
// This is what gets sent to the client and stored in the DB.
// ─────────────────────────────────────────────
export interface FullDecision extends QualitativeDecision {
  ticker: string;
  keyMetrics: {
    peRatio: string;
    forwardPE: string;
    revenueGrowth: string;
    profitMargin: string;
    debtToEquity: string;
    returnOnEquity: string;
    fiftyTwoWeekHigh: string;
    fiftyTwoWeekLow: string;
    currentPrice: string;
    marketCap: string;
    freeCashFlow: string;
    analystRating: string;
  };
  chartData?: string;          // JSON string of 90-day daily close prices
  competitorMetrics?: string;  // JSON string of competitor financials benchmarking
  critique?: string;           // Skeptical review by Devil's Advocate
}

