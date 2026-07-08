import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import yahooFinance from "yahoo-finance2";
import { QualitativeDecisionSchema } from "./schemas";
import type { FullDecision } from "./schemas";
import { cached } from "@/lib/cache";

// ─────────────────────────────────────────────
// Module-level singleton LLM (issue #5: was re-instantiated every call)
// ─────────────────────────────────────────────
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0.1,
  maxTokens: 1024,
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Jittered exponential backoff duration */
function backoffMs(attempt: number, baseMs = 3000): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponential + jitter, 60_000); // cap at 60s
}

/**
 * Invoke Groq with automatic retry on transient errors.
 * Handles 429 rate limits, 5xx server errors, and network timeouts.
 */
async function callLLM(prompt: string, retries = 5): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await llm.invoke([new HumanMessage(prompt)]);
      return typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      const isRateLimit = msg.includes("429") || msg.includes("rate_limit");
      const isTransient =
        isRateLimit ||
        msg.includes("500") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ECONNRESET") ||
        msg.includes("fetch failed");

      if (isTransient && attempt < retries) {
        let wait: number;
        if (isRateLimit) {
          // Groq often tells us how long to wait
          const match = msg.match(/try again in (\d+\.?\d*)s/);
          wait = match
            ? (Math.ceil(parseFloat(match[1])) + 3) * 1000
            : backoffMs(attempt);
        } else {
          wait = backoffMs(attempt);
        }
        console.log(
          `⏳ Transient error (attempt ${attempt + 1}/${retries}). Waiting ${Math.round(wait / 1000)}s... [${msg.slice(0, 80)}]`
        );
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded for LLM call");
}

// ─────────────────────────────────────────────
// Direct data fetchers — wrapped in TTL cache (issue #7a)
// ─────────────────────────────────────────────

/** Look up ticker symbol via Yahoo Finance */
async function fetchTicker(companyName: string): Promise<string> {
  return cached(`ticker:${companyName.toLowerCase()}`, async () => {
    try {
      const yf = new yahooFinance();
      const results = await yf.search(companyName);
      if (results.quotes?.length) {
        const q = results.quotes[0];
        return JSON.stringify({
          symbol: q.symbol,
          name:
            ("longname" in q ? q.longname : "") ||
            ("shortname" in q ? q.shortname : companyName),
          exchange: "exchange" in q ? q.exchange : "N/A",
        });
      }
      return JSON.stringify({
        symbol: companyName,
        name: companyName,
        exchange: "N/A",
      });
    } catch {
      return JSON.stringify({
        symbol: companyName,
        name: companyName,
        exchange: "N/A",
      });
    }
  });
}

/** Get financial data from Yahoo Finance — returns structured JSON */
async function fetchFinancials(ticker: string): Promise<string> {
  return cached(`financials:${ticker.toUpperCase()}`, async () => {
    try {
      const yf = new yahooFinance();
      const quote = await yf.quote(ticker);
      const summary = await yf.quoteSummary(ticker, {
        modules: ["summaryProfile", "financialData"],
      });
      return JSON.stringify({
        symbol: quote.symbol,
        price: quote.regularMarketPrice,
        marketCap: quote.marketCap,
        peRatio: quote.trailingPE,
        forwardPE: quote.forwardPE,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        revenueGrowth: summary.financialData?.revenueGrowth,
        profitMargin: summary.financialData?.profitMargins,
        debtToEquity: summary.financialData?.debtToEquity,
        freeCashFlow: summary.financialData?.freeCashflow,
        returnOnEquity: summary.financialData?.returnOnEquity,
        recommendationKey: summary.financialData?.recommendationKey,
        sector: summary.summaryProfile?.sector,
        industry: summary.summaryProfile?.industry,
        employees: summary.summaryProfile?.fullTimeEmployees,
        description: summary.summaryProfile?.longBusinessSummary?.slice(0, 500),
      });
    } catch (e) {
      console.warn(
        "⚠️ Yahoo Finance failed:",
        e instanceof Error ? e.message : e
      );
      return JSON.stringify({ error: "Financial data unavailable", symbol: ticker });
    }
  });
}

/** Search the web via Tavily */
async function fetchWebSearch(query: string): Promise<string> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 3,
        include_answer: true,
      }),
    });
    const data = await res.json();
    const answer = data.answer || "";
    const snippets = (data.results || [])
      .slice(0, 3)
      .map((r: { title: string; content: string }) => `${r.title}: ${r.content}`)
      .join("\n");
    return (answer + "\n" + snippets).slice(0, 1500);
  } catch {
    return "Search unavailable";
  }
}

/** Fetch news via NewsAPI */
async function fetchNews(companyName: string): Promise<string> {
  return cached(`news:${companyName.toLowerCase()}`, async () => {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) return "No NEWS_API_KEY configured";
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName)}&sortBy=publishedAt&language=en&pageSize=5&apiKey=${apiKey}`
      );
      const data = await res.json();
      if (!data.articles?.length) return "No recent news found";
      return data.articles
        .slice(0, 5)
        .map(
          (a: { title: string; description: string; publishedAt: string }) =>
            `[${a.publishedAt?.slice(0, 10)}] ${a.title}: ${a.description || ""}`
        )
        .join("\n")
        .slice(0, 1500);
    } catch {
      return "News unavailable";
    }
  });
}

// ─────────────────────────────────────────────
// Helper: format a number for display in key metrics
// ─────────────────────────────────────────────
function fmt(val: unknown, suffix = "", decimals = 2): string {
  if (val === null || val === undefined || val === "") return "N/A";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  if (suffix === "$" && Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (suffix === "$" && Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (suffix === "$" && Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (suffix === "$") return `$${num.toFixed(decimals)}`;
  if (suffix === "%") return `${(num * 100).toFixed(decimals)}%`;
  if (suffix === "x") return `${num.toFixed(decimals)}x`;
  return num.toFixed(decimals) + suffix;
}

// ─────────────────────────────────────────────
// State definition (issue #1: added rawFinancials)
// ─────────────────────────────────────────────
const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  companyName: Annotation<string>(),
  ticker: Annotation<string>(),
  researchPhase: Annotation<string>(),
  companyInfo: Annotation<string>(),
  /** Raw structured JSON from Yahoo Finance — carried through untouched */
  rawFinancials: Annotation<string>(),
  financialSummary: Annotation<string>(),
  newsSummary: Annotation<string>(),
  competitiveAnalysis: Annotation<string>(),
  riskAnalysis: Annotation<string>(),
  finalDecision: Annotation<string>(),
  isComplete: Annotation<boolean>(),
});

type AgentState = typeof AgentStateAnnotation.State;

// ─────────────────────────────────────────────
// NODE 1: Identify Company (direct API call)
// ─────────────────────────────────────────────
async function identifyCompanyNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("📍 Node 1: Identifying company...");
  const tickerData = await fetchTicker(state.companyName);
  const parsed = JSON.parse(tickerData);

  return {
    messages: [
      new HumanMessage(`Company: ${parsed.name}, Ticker: ${parsed.symbol}`),
    ],
    ticker: parsed.symbol || state.companyName,
    companyInfo: tickerData,
    researchPhase: "identifying_company",
  };
}

// ─────────────────────────────────────────────
// NODE 2: Financial Analysis (API + 1 LLM call)
// Now stores rawFinancials in state for the decision node.
// ─────────────────────────────────────────────
async function financialResearchNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("📊 Node 2: Fetching financials...");
  const rawData = await fetchFinancials(state.ticker);

  console.log("📊 Node 2: Analyzing with LLM...");
  const analysis = await callLLM(
    `Analyze these financials for ${state.companyName} (${state.ticker}):\n${rawData}\nGive a brief assessment in 5 bullet points covering: valuation, growth, profitability, debt, and analyst view. Max 150 words.`
  );

  return {
    messages: [new HumanMessage(`Financial Analysis:\n${analysis}`)],
    rawFinancials: rawData,
    financialSummary: analysis,
    researchPhase: "financial_research",
  };
}

// ─────────────────────────────────────────────
// NODE 3: News Research (API + 1 LLM call)
// ─────────────────────────────────────────────
async function newsResearchNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("📰 Node 3: Fetching news...");
  const newsData = await fetchNews(state.companyName);
  const searchData = await fetchWebSearch(
    `${state.companyName} latest news earnings 2024 2025`
  );

  console.log("📰 Node 3: Analyzing with LLM...");
  const analysis = await callLLM(
    `Summarize recent news for ${state.companyName}:\nNEWS: ${newsData}\nSEARCH: ${searchData}\nList 3 most impactful headlines and overall sentiment (positive/negative/neutral). Max 100 words.`
  );

  return {
    messages: [new HumanMessage(`News Analysis:\n${analysis}`)],
    newsSummary: analysis,
    researchPhase: "news_research",
  };
}

// ─────────────────────────────────────────────
// NODE 4: Competitive Analysis (API + 1 LLM call)
// ─────────────────────────────────────────────
async function competitiveAnalysisNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("⚔️ Node 4: Researching competition...");
  const searchData = await fetchWebSearch(
    `${state.companyName} competitors market share competitive advantage moat`
  );

  console.log("⚔️ Node 4: Analyzing with LLM...");
  const analysis = await callLLM(
    `Analyze competitive position of ${state.companyName}:\n${searchData}\nCover: top 3 competitors, competitive moat (Wide/Narrow/None), industry outlook. Max 100 words.`
  );

  return {
    messages: [new HumanMessage(`Competitive Analysis:\n${analysis}`)],
    competitiveAnalysis: analysis,
    researchPhase: "competitive_analysis",
  };
}

// ─────────────────────────────────────────────
// NODE 5: Risk Assessment (API + 1 LLM call)
// ─────────────────────────────────────────────
async function riskAssessmentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("⚠️ Node 5: Assessing risks...");
  const searchData = await fetchWebSearch(
    `${state.companyName} investment risks regulatory legal challenges`
  );

  console.log("⚠️ Node 5: Analyzing with LLM...");
  const analysis = await callLLM(
    `List top 5 investment risks for ${state.companyName}:\n${searchData}\nFormat each: Risk - Severity (High/Medium/Low) - one line. Max 100 words.`
  );

  return {
    messages: [new HumanMessage(`Risk Assessment:\n${analysis}`)],
    riskAnalysis: analysis,
    researchPhase: "risk_assessment",
  };
}

// ─────────────────────────────────────────────
// NODE 6: Final Decision
// Uses structured output for qualitative fields (issue #2).
// Injects real numbers from rawFinancials (issue #1).
// ─────────────────────────────────────────────
async function decisionNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("🧠 Node 6: Making investment decision...");

  // Parse raw financials for programmatic metric injection
  let rawMetrics: Record<string, unknown> = {};
  try {
    rawMetrics = JSON.parse(state.rawFinancials || "{}");
  } catch {
    console.warn("⚠️ Could not parse rawFinancials, metrics will show N/A");
  }

  const prompt = `You are a senior investment analyst. Based on this research about ${state.companyName} (${state.ticker}):

FINANCIALS: ${(state.financialSummary || "N/A").slice(0, 800)}
NEWS: ${(state.newsSummary || "N/A").slice(0, 500)}
COMPETITION: ${(state.competitiveAnalysis || "N/A").slice(0, 500)}
RISKS: ${(state.riskAnalysis || "N/A").slice(0, 500)}

Provide your investment decision. The decision must be either INVEST or PASS. The confidenceScore must be between 55 and 95. Provide 2-5 bull points and 2-5 bear points.`;

  // Use structured output — no more manual JSON parsing
  const structuredLlm = llm.withStructuredOutput(QualitativeDecisionSchema);

  let qualitative;
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      qualitative = await structuredLlm.invoke([new HumanMessage(prompt)]);
      break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (
        (msg.includes("429") || msg.includes("rate_limit")) &&
        attempt < 3
      ) {
        const wait = backoffMs(attempt, 5000);
        console.log(`⏳ Rate limited on structured output (attempt ${attempt + 1}/3). Waiting ${Math.round(wait / 1000)}s...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }

  if (!qualitative) {
    throw new Error("Failed to get structured decision from LLM");
  }

  // Build the full decision with REAL numbers injected programmatically
  const fullDecision: FullDecision = {
    ...qualitative,
    ticker: state.ticker,
    keyMetrics: {
      peRatio: fmt(rawMetrics.peRatio, "x"),
      forwardPE: fmt(rawMetrics.forwardPE, "x"),
      revenueGrowth: fmt(rawMetrics.revenueGrowth, "%"),
      profitMargin: fmt(rawMetrics.profitMargin, "%"),
      debtToEquity: fmt(rawMetrics.debtToEquity),
      returnOnEquity: fmt(rawMetrics.returnOnEquity, "%"),
      fiftyTwoWeekHigh: fmt(rawMetrics.fiftyTwoWeekHigh, "$"),
      fiftyTwoWeekLow: fmt(rawMetrics.fiftyTwoWeekLow, "$"),
      currentPrice: fmt(rawMetrics.price, "$"),
      marketCap: fmt(rawMetrics.marketCap, "$"),
      freeCashFlow: fmt(rawMetrics.freeCashFlow, "$"),
      analystRating: String(rawMetrics.recommendationKey || "N/A"),
    },
  };

  console.log("🤖 Final Decision:", JSON.stringify(fullDecision, null, 2));

  return {
    messages: [new HumanMessage(JSON.stringify(fullDecision))],
    finalDecision: JSON.stringify(fullDecision),
    researchPhase: "decision_made",
    isComplete: true,
  };
}

// ─────────────────────────────────────────────
// BUILD THE GRAPH — Simple linear chain
// ─────────────────────────────────────────────
export function buildInvestmentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("identify_company", identifyCompanyNode)
    .addNode("financial_research", financialResearchNode)
    .addNode("news_research", newsResearchNode)
    .addNode("competitive_analysis", competitiveAnalysisNode)
    .addNode("risk_assessment", riskAssessmentNode)
    .addNode("decision", decisionNode)

    // Simple linear flow
    .addEdge(START, "identify_company")
    .addEdge("identify_company", "financial_research")
    .addEdge("financial_research", "news_research")
    .addEdge("news_research", "competitive_analysis")
    .addEdge("competitive_analysis", "risk_assessment")
    .addEdge("risk_assessment", "decision")
    .addEdge("decision", END);

  return graph.compile();
}
