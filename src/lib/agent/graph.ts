import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import yahooFinance from "yahoo-finance2";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Invoke Groq with automatic retry on 429 rate limits */
async function callLLM(prompt: string, retries = 5): Promise<string> {
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    maxTokens: 1024,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await llm.invoke([new HumanMessage(prompt)]);
      return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("429") || msg.includes("rate_limit")) {
        const match = msg.match(/try again in (\d+\.?\d*)s/);
        const wait = match ? Math.ceil(parseFloat(match[1])) + 3 : 20;
        console.log(`⏳ Rate limited (attempt ${attempt + 1}/${retries}). Waiting ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded for LLM call");
}

// ─────────────────────────────────────────────
// Direct data fetchers (NO LLM tool-calling)
// ─────────────────────────────────────────────

/** Look up ticker symbol via Yahoo Finance */
async function fetchTicker(companyName: string): Promise<string> {
  try {
    const yf = new yahooFinance();
    const results = await yf.search(companyName);
    if (results.quotes?.length) {
      const q = results.quotes[0];
      return JSON.stringify({
        symbol: q.symbol,
        name: "longname" in q ? q.longname : ("shortname" in q ? q.shortname : companyName),
        exchange: "exchange" in q ? q.exchange : "N/A",
      });
    }
    return JSON.stringify({ symbol: companyName, name: companyName, exchange: "N/A" });
  } catch {
    return JSON.stringify({ symbol: companyName, name: companyName, exchange: "N/A" });
  }
}

/** Get financial data from Yahoo Finance */
async function fetchFinancials(ticker: string): Promise<string> {
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
    console.warn("⚠️ Yahoo Finance failed:", e instanceof Error ? e.message : e);
    return JSON.stringify({ error: "Financial data unavailable", symbol: ticker });
  }
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
      .map((a: { title: string; description: string; publishedAt: string }) =>
        `[${a.publishedAt?.slice(0, 10)}] ${a.title}: ${a.description || ""}`
      )
      .join("\n")
      .slice(0, 1500);
  } catch {
    return "News unavailable";
  }
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
async function identifyCompanyNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("📍 Node 1: Identifying company...");
  const tickerData = await fetchTicker(state.companyName);
  const parsed = JSON.parse(tickerData);

  return {
    messages: [new HumanMessage(`Company: ${parsed.name}, Ticker: ${parsed.symbol}`)],
    ticker: parsed.symbol || state.companyName,
    companyInfo: tickerData,
    researchPhase: "identifying_company",
  };
}

// ─────────────────────────────────────────────
// NODE 2: Financial Analysis (API + 1 LLM call)
// ─────────────────────────────────────────────
async function financialResearchNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("📊 Node 2: Fetching financials...");
  const rawData = await fetchFinancials(state.ticker);

  console.log("📊 Node 2: Analyzing with LLM...");
  const analysis = await callLLM(
    `Analyze these financials for ${state.companyName} (${state.ticker}):
${rawData}
Give a brief assessment in 5 bullet points covering: valuation, growth, profitability, debt, and analyst view. Max 150 words.`
  );

  return {
    messages: [new HumanMessage(`Financial Analysis:\n${analysis}`)],
    financialSummary: analysis,
    researchPhase: "financial_research",
  };
}

// ─────────────────────────────────────────────
// NODE 3: News Research (API + 1 LLM call)
// ─────────────────────────────────────────────
async function newsResearchNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("📰 Node 3: Fetching news...");
  const newsData = await fetchNews(state.companyName);
  const searchData = await fetchWebSearch(`${state.companyName} latest news earnings 2024 2025`);

  console.log("📰 Node 3: Analyzing with LLM...");
  const analysis = await callLLM(
    `Summarize recent news for ${state.companyName}:
NEWS: ${newsData}
SEARCH: ${searchData}
List 3 most impactful headlines and overall sentiment (positive/negative/neutral). Max 100 words.`
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
async function competitiveAnalysisNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("⚔️ Node 4: Researching competition...");
  const searchData = await fetchWebSearch(
    `${state.companyName} competitors market share competitive advantage moat`
  );

  console.log("⚔️ Node 4: Analyzing with LLM...");
  const analysis = await callLLM(
    `Analyze competitive position of ${state.companyName}:
${searchData}
Cover: top 3 competitors, competitive moat (Wide/Narrow/None), industry outlook. Max 100 words.`
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
async function riskAssessmentNode(state: AgentState): Promise<Partial<AgentState>> {
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
// NODE 6: Final Decision (1 LLM call with all summaries)
// ─────────────────────────────────────────────
async function decisionNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("🧠 Node 6: Making investment decision...");

  const prompt = `You are a senior investment analyst. Based on this research about ${state.companyName} (${state.ticker}):

FINANCIALS: ${(state.financialSummary || "N/A").slice(0, 800)}
NEWS: ${(state.newsSummary || "N/A").slice(0, 500)}
COMPETITION: ${(state.competitiveAnalysis || "N/A").slice(0, 500)}
RISKS: ${(state.riskAnalysis || "N/A").slice(0, 500)}

Return ONLY valid JSON:
{"decision":"INVEST","confidenceScore":72,"ticker":"${state.ticker}","reasoning":"2-3 sentences explaining the decision","bullPoints":["point1","point2","point3"],"bearPoints":["point1","point2","point3"],"financialHealth":"Good","moatStrength":"Wide","growthProspects":"High","riskLevel":"Medium","timeHorizon":"Long-term","keyMetrics":{"peRatio":"25x","revenueGrowth":"15%","profitMargin":"20%","debtLevel":"Low"}}

Rules: decision must be INVEST or PASS. confidenceScore 55-95. Fill all fields with real data from the research. Return ONLY the JSON object.`;

  const response = await callLLM(prompt);

  return {
    messages: [new HumanMessage(response)],
    finalDecision: response,
    researchPhase: "decision_made",
    isComplete: true,
  };
}

// ─────────────────────────────────────────────
// BUILD THE GRAPH — Simple linear chain, no tool loops
// ─────────────────────────────────────────────
export function buildInvestmentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("identify_company", identifyCompanyNode)
    .addNode("financial_research", financialResearchNode)
    .addNode("news_research", newsResearchNode)
    .addNode("competitive_analysis", competitiveAnalysisNode)
    .addNode("risk_assessment", riskAssessmentNode)
    .addNode("decision", decisionNode)

    // Simple linear flow: no tool loops, no conditional routing
    .addEdge(START, "identify_company")
    .addEdge("identify_company", "financial_research")
    .addEdge("financial_research", "news_research")
    .addEdge("news_research", "competitive_analysis")
    .addEdge("competitive_analysis", "risk_assessment")
    .addEdge("risk_assessment", "decision")
    .addEdge("decision", END);

  return graph.compile();
}
