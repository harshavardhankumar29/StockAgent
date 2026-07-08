// ─────────────────────────────────────────────
// Client-side types used by React components
// The authoritative decision schema lives in src/lib/agent/schemas.ts
// ─────────────────────────────────────────────

export interface DecisionData {
  id?: string;
  decision: "INVEST" | "PASS";
  confidenceScore: number;
  ticker: string;
  reasoning: string;
  bullPoints: string[];
  bearPoints: string[];
  financialHealth: string;
  moatStrength: string;
  growthProspects: string;
  riskLevel: string;
  timeHorizon: string;
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
  chartData?: string;
  competitorMetrics?: string;
  critique?: string;
}


export interface ProgressStep {
  step: string;
  message: string;
  status: "running" | "complete" | "pending";
}
