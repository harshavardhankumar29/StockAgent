import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import yahooFinance from "yahoo-finance2";
import { QualitativeDecisionSchema } from "./schemas";
import type { FullDecision } from "./schemas";
import { cached } from "@/lib/cache";
import {
  calculateDCF,
  calculateSMA,
  calculateRSI,
  calculateMACD
} from "./financialAnalysis";

// ─────────────────────────────────────────────
// Module-level singleton LLM
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
  return Math.min(exponential + jitter, 60_000);
}

/**
 * Invoke Groq with automatic retry on transient errors.
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

// Helper to format values
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
// Direct data fetchers
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

/** Get financial data from Yahoo Finance */
async function fetchFinancials(ticker: string): Promise<string> {
  return cached(`financials:${ticker.toUpperCase()}`, async () => {
    try {
      const yf = new yahooFinance();
      const quote = await yf.quote(ticker);
      const summary = await yf.quoteSummary(ticker, {
        modules: ["summaryProfile", "financialData", "defaultKeyStatistics"],
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
        freeCashflow: summary.financialData?.freeCashflow,
        operatingCashflow: summary.financialData?.operatingCashflow,
        totalCash: summary.financialData?.totalCash,
        totalDebt: summary.financialData?.totalDebt,
        beta: summary.defaultKeyStatistics?.beta,
        sharesOutstanding: summary.defaultKeyStatistics?.sharesOutstanding,
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

/** Fetch historical price charts and calculate indicators */
async function fetchChartAndIndicators(ticker: string) {
  return cached(`chart-indicators:${ticker.toUpperCase()}`, async () => {
    try {
      const yf = new yahooFinance();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const chartData = await yf.chart(ticker, {
        period1: oneYearAgo.toISOString().split("T")[0],
        interval: "1d"
      });
      
      const quotes = chartData.quotes || [];
      const closePrices = quotes.map(q => q.close).filter((p): p is number => typeof p === "number");
      
      const sma50 = calculateSMA(closePrices, 50);
      const sma200 = calculateSMA(closePrices, 200);
      const rsi14 = calculateRSI(closePrices, 14);
      const macd = calculateMACD(closePrices);
      
      // Filter to the last 90 trading days for the frontend SVG chart
      const last90Quotes = quotes.slice(-90).map(q => ({
        date: q.date ? new Date(q.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
        close: q.close ? Number(q.close.toFixed(2)) : 0
      })).filter(q => q.close > 0);
      
      return {
        sma50,
        sma200,
        rsi14,
        macd: macd ? `${macd.macd} (Signal: ${macd.signal}) - ${macd.sentiment}` : "N/A",
        chartPoints: JSON.stringify(last90Quotes)
      };
    } catch (e) {
      console.warn("⚠️ Failed to fetch chart/indicators:", e);
      return {
        sma50: "N/A",
        sma200: "N/A",
        rsi14: "N/A",
        macd: "N/A",
        chartPoints: "[]"
      };
    }
  });
}

/** Fetch insider transactions and institutional holdings */
async function fetchInsiderAndInstitutions(ticker: string) {
  return cached(`insiders:${ticker.toUpperCase()}`, async () => {
    try {
      const yf = new yahooFinance();
      const summary = await yf.quoteSummary(ticker, {
        modules: ["insiderTransactions", "institutionOwnership"]
      });
      
      const transactions = (summary.insiderTransactions?.transactions || [])
        .slice(0, 5)
        .map(t => `[${t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : ''}] ${t.filerName} (${t.filerRelation}): ${t.transactionText || 'No detail'}`)
        .join("\n");
        
      const institutions = (summary.institutionOwnership?.ownershipList || [])
        .slice(0, 3)
        .map(i => `${i.organization}: Held ${((i.pctHeld || 0) * 100).toFixed(2)}% (Value: $${((i.value || 0) / 1e9).toFixed(2)}B)`)
        .join("\n");
        
      return {
        transactions: transactions || "No recent insider transactions reported.",
        institutions: institutions || "No institutional holders reported."
      };
    } catch (e) {
      console.warn("⚠️ Failed to fetch insider/institutions info:", e);
      return {
        transactions: "Insider transactions unavailable.",
        institutions: "Institutional ownership unavailable."
      };
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

/** Fetch competitor metrics for comparison matrix */
async function fetchCompetitorMetrics(competitorsList: string[]) {
  const list = [];
  for (const comp of competitorsList) {
    const ticker = comp.trim().toUpperCase();
    if (!ticker) continue;
    try {
      const yf = new yahooFinance();
      const quote = await yf.quote(ticker);
      const summary = await yf.quoteSummary(ticker, {
        modules: ["financialData"]
      });
      list.push({
        ticker,
        name: quote.shortName || quote.longName || ticker,
        price: fmt(quote.regularMarketPrice, "$"),
        marketCap: fmt(quote.marketCap, "$"),
        peRatio: fmt(quote.trailingPE, "x"),
        profitMargin: fmt(summary.financialData?.profitMargins, "%"),
        revenueGrowth: fmt(summary.financialData?.revenueGrowth, "%"),
        debtToEquity: fmt(summary.financialData?.debtToEquity)
      });
    } catch {
      // skip failed competitor fetches
    }
  }
  return list;
}

// ─────────────────────────────────────────────
// State definition
// ─────────────────────────────────────────────
const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  companyName: Annotation<string>(),
  ticker: Annotation<string>(),
  researchPhase: Annotation<string>(),
  companyInfo: Annotation<string>(),
  rawFinancials: Annotation<string>(),
  financialSummary: Annotation<string>(),
  newsSummary: Annotation<string>(),
  competitiveAnalysis: Annotation<string>(),
  riskAnalysis: Annotation<string>(),
  chartData: Annotation<string>(),          // [NEW] 90-day daily price points JSON
  competitorMetrics: Annotation<string>(),  // [NEW] competitor matrix JSON
  critique: Annotation<string>(),           // [NEW] Devil's Advocate critique report
  finalDecision: Annotation<string>(),
  isComplete: Annotation<boolean>(),
});

type AgentState = typeof AgentStateAnnotation.State;

// ─────────────────────────────────────────────
// NODE 1: Identify Company
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
// NODE 2: Financial Analysis (API + Indicators + DCF + LLM)
// ─────────────────────────────────────────────
async function financialResearchNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("📊 Node 2: Fetching financials & charts...");
  const rawData = await fetchFinancials(state.ticker);
  const indicators = await fetchChartAndIndicators(state.ticker);
  
  let dcfValuation = "N/A";
  try {
    const rawMetrics = JSON.parse(rawData);
    const dcfRes = calculateDCF(rawMetrics, rawMetrics); // passes raw data containing beta and shares
    dcfValuation = dcfRes.error
      ? dcfRes.error
      : `Intrinsic Value: $${dcfRes.intrinsicValue} (Upside: ${dcfRes.upside}, WACC: ${dcfRes.wacc})`;
  } catch (e) {
    console.warn("⚠️ Failed to parse financials for DCF:", e);
  }

  console.log("📊 Node 2: Analyzing with LLM...");
  const analysis = await callLLM(
    `Analyze these financials for ${state.companyName} (${state.ticker}):
FINANCIALS: ${rawData}
INDICATORS: SMA50: ${indicators.sma50}, SMA200: ${indicators.sma200}, RSI: ${indicators.rsi14}, MACD: ${indicators.macd}
DCF VALUATION: ${dcfValuation}

Give a brief assessment in 5 bullet points covering: valuation (include the DCF intrinsic value findings), growth, profitability, momentum/indicators, and analyst views. Max 150 words.`
  );

  return {
    messages: [new HumanMessage(`Financial Analysis:\n${analysis}`)],
    rawFinancials: rawData,
    chartData: indicators.chartPoints,
    financialSummary: analysis,
    researchPhase: "financial_research",
  };
}

// ─────────────────────────────────────────────
// NODE 3: News Research (API + Insiders + LLM)
// ─────────────────────────────────────────────
async function newsResearchNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("📰 Node 3: Fetching news & insider data...");
  const newsData = await fetchNews(state.companyName);
  const searchData = await fetchWebSearch(
    `${state.companyName} latest news earnings 2024 2025`
  );
  const insiderInfo = await fetchInsiderAndInstitutions(state.ticker);

  console.log("📰 Node 3: Analyzing with LLM...");
  const analysis = await callLLM(
    `Summarize recent news and trading activity for ${state.companyName}:
NEWS: ${newsData}
SEARCH: ${searchData}
INSIDER TRANSACTIONS: ${insiderInfo.transactions}
INSTITUTIONAL OWNERSHIP: ${insiderInfo.institutions}

List 3 most impactful headlines or insider events and overall sentiment. Max 100 words.`
  );

  return {
    messages: [new HumanMessage(`News Analysis:\n${analysis}`)],
    newsSummary: analysis,
    researchPhase: "news_research",
  };
}

// ─────────────────────────────────────────────
// NODE 4: Competitive Analysis (API + Competitor benchmark + LLM)
// ─────────────────────────────────────────────
async function competitiveAnalysisNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("⚔️ Node 4: Researching competition...");
  
  // Ask LLM to identify competitor tickers
  const promptCompetitors = `Identify the top 2-3 direct publicly traded competitors of ${state.companyName} (${state.ticker}). 
Return ONLY a comma-separated list of their stock ticker symbols (e.g. MSFT,AMZN,GOOGL). No prose, no tags.`;
  const competitorsText = await callLLM(promptCompetitors);
  const competitors = competitorsText.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  
  console.log(`⚔️ Node 4: Identified competitors: ${competitors.join(", ")}`);
  const competitorMatrix = await fetchCompetitorMetrics(competitors);

  const searchData = await fetchWebSearch(
    `${state.companyName} competitors market share competitive advantage moat`
  );

  console.log("⚔️ Node 4: Analyzing with LLM...");
  const analysis = await callLLM(
    `Analyze competitive position of ${state.companyName}:
SEARCH: ${searchData}
COMPETITORS BENCHMARK: ${JSON.stringify(competitorMatrix)}

Cover: top competitors comparison, competitive moat (Wide/Narrow/None), and industry outlook. Max 100 words.`
  );

  return {
    messages: [new HumanMessage(`Competitive Analysis:\n${analysis}`)],
    competitorMetrics: JSON.stringify(competitorMatrix),
    competitiveAnalysis: analysis,
    researchPhase: "competitive_analysis",
  };
}

// ─────────────────────────────────────────────
// NODE 5: Risk Assessment (API + LLM)
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
    `List top 5 investment risks for ${state.companyName}:
${searchData}
Format each: Risk - Severity (High/Medium/Low) - one line. Max 100 words.`
  );

  return {
    messages: [new HumanMessage(`Risk Assessment:\n${analysis}`)],
    riskAnalysis: analysis,
    researchPhase: "risk_assessment",
  };
}

// ─────────────────────────────────────────────
// NODE 5.5: Devil's Advocate Critique [NEW]
// ─────────────────────────────────────────────
async function critiqueNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("😈 Node 5.5: Devil's Advocate Critique...");
  
  const prompt = `You are a skeptical, cynical, senior risk officer at an investment bank.
Your job is to look at this research for ${state.companyName} (${state.ticker}) and critique it.
Highlight why this might be a bad investment, identify all blind spots, risk factors, regulatory hurdles, and why the bullish thesis might fail.
Be extremely critical. Do not write anything positive.

FINANCIALS: ${state.financialSummary}
NEWS SENTIMENT: ${state.newsSummary}
COMPETITIVE LANDSCAPE: ${state.competitiveAnalysis}
RISK ASSESSMENT: ${state.riskAnalysis}

Write a detailed critique in 3 bullet points (max 200 words).`;

  const critiqueReport = await callLLM(prompt);
  
  return {
    messages: [new HumanMessage(`Devil's Advocate Critique:\n${critiqueReport}`)],
    critique: critiqueReport,
    researchPhase: "devil_advocate_critique",
  };
}

// ─────────────────────────────────────────────
// NODE 6: Final Decision
// ─────────────────────────────────────────────
async function decisionNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("🧠 Node 6: Making investment decision...");

  let rawMetrics: Record<string, any> = {};
  try {
    rawMetrics = JSON.parse(state.rawFinancials || "{}");
  } catch {
    console.warn("⚠️ Could not parse rawFinancials");
  }

  // Fetch indicators for metric injection
  const indicators = await fetchChartAndIndicators(state.ticker);

  // Compute programmatic DCF values
  const dcf = calculateDCF(rawMetrics, rawMetrics);

  const prompt = `You are a senior investment analyst. Based on this research about ${state.companyName} (${state.ticker}):

FINANCIALS: ${(state.financialSummary || "N/A").slice(0, 800)}
NEWS: ${(state.newsSummary || "N/A").slice(0, 500)}
COMPETITION: ${(state.competitiveAnalysis || "N/A").slice(0, 500)}
RISKS: ${(state.riskAnalysis || "N/A").slice(0, 500)}
DEVIL'S ADVOCATE CRITIQUE: ${(state.critique || "N/A").slice(0, 800)}

Provide your investment decision. The decision must be either INVEST or PASS. The confidenceScore must be between 55 and 95. Provide 2-5 bull points and 2-5 bear points. Take the critique seriously and adjust the confidence score accordingly.`;

  const structuredLlm = llm.withStructuredOutput(QualitativeDecisionSchema);

  let qualitative;
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      qualitative = await structuredLlm.invoke([new HumanMessage(prompt)]);
      break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if ((msg.includes("429") || msg.includes("rate_limit")) && attempt < 3) {
        const wait = backoffMs(attempt, 5000);
        console.log(`⏳ Rate limited on structured output. Waiting ${Math.round(wait / 1000)}s...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }

  if (!qualitative) {
    throw new Error("Failed to get structured decision from LLM");
  }

  // Combine qualitative decision with real numbers & new critique data
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
      freeCashFlow: dcf.intrinsicValue !== "N/A" ? `$${Number(rawMetrics.freeCashflow).toLocaleString()}` : "N/A",
      analystRating: dcf.intrinsicValue !== "N/A"
        ? `DCF: $${dcf.intrinsicValue} (${dcf.upside} upside)`
        : String(rawMetrics.recommendationKey || "N/A"),
    },
    chartData: state.chartData || "[]",
    competitorMetrics: state.competitorMetrics || "[]",
    critique: state.critique || "",
  };

  return {
    messages: [new HumanMessage(JSON.stringify(fullDecision))],
    finalDecision: JSON.stringify(fullDecision),
    researchPhase: "decision_made",
    isComplete: true,
  };
}

// ─────────────────────────────────────────────
// BUILD THE GRAPH
// ─────────────────────────────────────────────
export function buildInvestmentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("identify_company", identifyCompanyNode)
    .addNode("financial_research", financialResearchNode)
    .addNode("news_research", newsResearchNode)
    .addNode("competitive_analysis", competitiveAnalysisNode)
    .addNode("risk_assessment", riskAssessmentNode)
    .addNode("critique", critiqueNode) // [NEW]
    .addNode("decision", decisionNode)

    .addEdge(START, "identify_company")
    .addEdge("identify_company", "financial_research")
    .addEdge("financial_research", "news_research")
    .addEdge("news_research", "competitive_analysis")
    .addEdge("competitive_analysis", "risk_assessment")
    .addEdge("risk_assessment", "critique") // [NEW]
    .addEdge("critique", "decision")       // [NEW]
    .addEdge("decision", END);

  return graph.compile();
}
