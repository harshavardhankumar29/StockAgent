# StockAgent.AI

An AI-powered investment research agent built with **Next.js**, **LangGraph**, and **Groq**. It retrieves live financial metrics, news sentiment, and competitive analyses, performs intrinsic DCF valuations, subjects the thesis to a "Devil's Advocate" critique, and outputs structured, fully-reasoned `INVEST` or `PASS` recommendations.

---

## 1. Overview
**StockAgent.AI** is a multi-agent investment analyst. The application:
*   **Performs Multi-Node Research Pipelines**: Connects live market data extraction with LLM reasoning.
*   **Conducts Dual-Perspective Analysis**: Features an optimistic "Analyst" agent team balanced by an adversarial "Devil's Advocate" critique node that actively seeks out vulnerabilities in the bullish thesis.
*   **Calculates Financial Fair Value**: Includes programmatic Cost of Equity and Discounted Cash Flow (DCF) models.
*   **Streams Live Progress**: Employs Server-Sent Events (SSE) to update the frontend step-by-step as each agent completes its tasks.
*   **Supports Batch Stock Analysis**: Allows research of multiple companies in parallel or sequentially.
*   **Builds Portfolios and Watchlists**: Allows tracking mock investments, PnL, and live watchlists of starred stocks.

---

## 2. How to Run It (Setup & Run Steps)

### Prerequisites
*   Node.js 18+ installed on your system
*   A running PostgreSQL instance (e.g., [Neon.tech](https://neon.tech/))

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory for Next.js runtime configurations:
```env
# Clerk Authentication (https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Groq LLM API Key (https://console.groq.com)
GROQ_API_KEY=gsk_...

# Tavily Search API Key (https://tavily.com)
TAVILY_API_KEY=tvly-...

# NewsAPI Key (https://newsapi.org)
NEWS_API_KEY=...
```

Create a `.env` file in the root directory for Prisma migration configurations:
```env
# Database connection string
DATABASE_URL="postgresql://neondb_owner:npg_...aws.neon.tech/neondb?sslmode=require"
```

### 3. Initialize the Database
Sync the PostgreSQL database schema using Prisma:
```bash
npx prisma db push
npx prisma generate
```

### 4. Start the Application
Run the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. How It Works (Approach & Architecture)

The system is built on a modular state machine architecture using **LangGraph** to coordinate multiple specialized agent nodes.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Next.js Frontend                              │
│         Tag-Input Search Bar  ──►  SSE Stream  ──►  ResearchLoader       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ POST /api/research
┌────────────────────────────────────▼────────────────────────────────────┐
│                        LangGraph Agent Pipeline                         │
│                                                                         │
│  Node 0: Load Context (Ingest optional PDF/Image research attachments)  │
│      │                                                                  │
│  Node 1: Identify Company (Yahoo Finance Ticker Search & Validation)   │
│      │                                                                  │
│  Node 2: Financial Research (Yahoo Finance Data Fetch + DCF Valuation)  │
│      │                                                                  │
│  Node 3: News Research (NewsAPI + Tavily Live Sentiment Extraction)     │
│      │                                                                  │
│  Node 4: Competitive Analysis (Competitor identification & metrics)     │
│      │                                                                  │
│  Node 5: Risk Assessment ( हेडविंड / Headwind & regulatory evaluation)   │
│      │                                                                  │
│  Node 6: Devil's Advocate Critique (Bullish counter-thesis critique)    │
│      │                                                                  │
│  Node 7: Investment Decision (Structured INVEST/PASS verdict generation) │
└─────────────────────────────────────────────────────────────────────────┘
```

### Node Mechanics:
1.  **Node 0 (Load Context)**: Pulls user-uploaded document context if present.
2.  **Node 1 (Identify Company)**: Searches Yahoo Finance to resolve company queries (e.g. "Apple") to precise tickers (e.g. `AAPL`).
3.  **Node 2 (Financial Research)**: Pulls statistics (P/E ratio, profit margins, growth rates) and runs a DCF calculator based on WACC.
4.  **Node 3 (News Research)**: Scrapes Google/Bing via Tavily + NewsAPI to gauge short-term sentiment.
5.  **Node 4 (Competitive Analysis)**: Aggregates valuation metrics (P/E, Market Cap) for the top three competitors.
6.  **Node 5 (Risk Assessment)**: Extracts macroeconomic, regulatory, and financial risks.
7.  **Node 6 (Devil's Advocate)**: Takes all bullish research gathered so far and writes a harsh, skeptical critique of the stock.
8.  **Node 7 (Decision)**: Weighs the bullish research against the Devil's Advocate critique to produce a structured JSON decision.

---

## 4. Key Decisions & Trade-offs

*   **Server-Sent Events (SSE) vs WebSockets**: We chose Next.js Route Handlers streaming via SSE. It uses standard HTTP and doesn't require maintaining a stateful WebSocket server infrastructure, making the app highly serverless-compatible.
*   **LangGraph State Management vs Freeform Chains**: LangGraph enforces a strict state model. This guarantees that financial data, news summaries, and risk analyses are properly aggregated in a single state container before the decision is reached, preventing AI hallucinations.
*   **Adversarial Critic (Devil's Advocate)**: Standard LLMs suffer from positive confirmation bias. By forcing a dedicated critique node, we ensure every `INVEST` decision is balanced by real skepticism, resulting in lower, realistic confidence scores.
*   **Structured Output Fallbacks**: Groq's tool-calling functionality can occasionally throw `tool_use_failed` errors. We implemented a robust fallback in Node 6 that catches these errors, attempts to extract JSON from the error's `failed_generation` field, and falls back to a standard text completion parsed manually.
*   **DCF Safety Floors**: To prevent division-by-zero or negative intrinsic valuations (common with low-beta or negative-beta stocks on Yahoo Finance), we implemented a floor on the Weighted Average Cost of Capital (WACC), enforcing a minimum discount rate.

---

## 5. Example Runs

### Example 1: Apple Inc. (`AAPL`)
*   **Verdict**: `INVEST`
*   **Confidence Score**: `65/100` (decreased due to critique)
*   **Reasoning**: Apple boasts outstanding profitability, a wide competitive moat, and strong brand loyalty. However, the confidence score is moderated because of EU regulatory disputes, high market valuation, and potential antitrust fines.
*   **Bull Points**: Strong brand loyalty, healthy profit margins (27.15%), stable revenue growth.
*   **Bear Points**: Regulatory scrutiny, high premium valuation, legal challenges.

### Example 2: Tesla Inc. (`TSLA`)
*   **Verdict**: `PASS`
*   **Confidence Score**: `60/100`
*   **Reasoning**: Despite strong vehicle delivery performance, TSLA's low profit margin (3.95%), massive premium valuation (P/E ~370x), and aggressive scale/cost competition from BYD make it a pass at current prices.
*   **Bull Points**: Advanced software/battery technology, positive EV adoption trends.
*   **Bear Points**: Low current profit margins, regulatory probes, extreme competition.

### Example 3: NVIDIA Corporation (`NVDA`)
*   **Verdict**: `INVEST`
*   **Confidence Score**: `70/100`
*   **Reasoning**: NVIDIA maintains absolute dominance in the AI GPU market and exhibits phenomenal profitability (62% margin). Export controls and high market concentration represent risks, but do not override the secular AI trend.
*   **Bull Points**: High profit margin, dominant GPU market share, analyst buy recommendations.
*   **Bear Points**: Geopolitical export restrictions, market concentration.

---

## 6. What We Would Improve with More Time
1.  **Background Queue Handler**: Use Inngest or BullMQ to handle long-running research tasks asynchronously. Next.js serverless functions have execution duration limits (usually 10s-30s on free plans).
2.  **RAG Enhancements**: Add chunking and vector storage (using pgvector) to perform semantic search over multiple uploaded 10-K PDFs instead of simple string truncation.
3.  **Brokerage Integration**: Link live paper-trading accounts to allow automated execution of mock buy/sell orders.
4.  **Multi-Modal Chart Reading**: Ingest stock chart images and use Vision LLMs to perform technical analysis (support, resistance, pattern indicators).

---

## 7. Transcript Logs (Bonus Points)
To review the complete agent pairing history, including prompt-response details, please see:
*   [llm_chat_history.md](file:///Users/harsha/Desktop/StockAgent/llm_chat_history.md)

---
*Disclaimer: Not financial advice. For educational purposes only.*
