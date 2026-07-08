export interface FinancialData {
  symbol: string;
  currentPrice: number;
  marketCap: number;
  peRatio: number;
  revenueGrowth: number;
  profitMargin: number;
  debtToEquity: number;
  freeCashFlow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  analystRating: string;
  sector: string;
  industry: string;
  employees: number;
  description: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface Risk {
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface AgentState {
  // Input
  companyName: string;
  ticker: string;

  // Research sections
  financialData: FinancialData | null;
  newsItems: NewsItem[];
  competitiveAnalysis: string;
  riskAnalysis: Risk[];
  businessOverview: string;

  // Decision
  decision: "INVEST" | "PASS" | "PENDING";
  confidenceScore: number;
  reasoning: string;
  bullPoints: string[];
  bearPoints: string[];
  sources: string[];

  // Progress tracking
  currentStep: string;
  completedSteps: string[];
  errors: string[];
  isComplete: boolean;
}

export interface ResearchReport {
  companyName: string;
  ticker: string;
  decision: "INVEST" | "PASS";
  confidenceScore: number;
  reasoning: string;
  bullPoints: string[];
  bearPoints: string[];
  financialData: FinancialData | null;
  newsItems: NewsItem[];
  riskAnalysis: Risk[];
  businessOverview: string;
  competitiveAnalysis: string;
  sources: string[];
  generatedAt: string;
}

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
    revenueGrowth: string;
    profitMargin: string;
    debtLevel: string;
  };
}

export interface ProgressStep {
  step: string;
  message: string;
  status: "running" | "complete" | "pending";
}
