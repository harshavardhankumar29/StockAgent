# StockAgent.AI

An AI-powered investment research agent built with **Next.js**, **LangGraph**, and **Groq**. Enter any company name, a comma-separated list of companies for batch research, or upload stock charts/earnings PDFs to get a comprehensive investment analysis with a clear INVEST or PASS verdict — backed by real financial data, news sentiment, competitive analysis, and Devil's Advocate critique.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Next.js Frontend                              │
│  HeroSearch (Drag & Drop PDFs/Images) → SSE Stream → ResearchLoader     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ POST /api/research (SSE)
┌────────────────────────────────────▼────────────────────────────────────┐
│                        LangGraph Agent Pipeline                         │
│                                                                         │
│  Node 0: Load Context (Upload Ingestion PDF text/Groq Vision summary)   │
│      ↓                                                                  │
│  Node 1: Identify Company (Yahoo Finance Ticker Search)                 │
│      ↓                                                                  │
│  Node 2: Financial Analysis (Yahoo Finance Stats + DCF Math)            │
│      ↓                                                                  │
│  Node 3: News Research (NewsAPI + Tavily + LLM Sentiment)               │
│      ↓                                                                  │
│  Node 4: Competitive Analysis (Tavily competitor list & metrics)        │
│      ↓                                                                  │
│  Node 5: Risk Assessment (Tavily + LLM)                                 │
│      ↓                                                                  │
│  Node 6: Devil's Advocate Critique (Counter-thesis validation)          │
│      ↓                                                                  │
│  Node 7: Investment Decision (Structured Output Verdict)                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│  Storage: Neon PostgreSQL (database)                                    │
│  Auth: Clerk (user authentication)                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack, Suspense Boundaries) |
| **AI Agent** | LangGraph + LangChain |
| **LLM Engine** | Groq Llama 3.3 (70B) & Llama 3.2 Vision (11B) |
| **Financial Data** | Yahoo Finance (free, no API key required) |
| **Web Search** | Tavily Search API (1,000 free searches/month) |
| **News Feed** | NewsAPI (100 free requests/day) |
| **Database** | Neon PostgreSQL via Prisma (PrismaPg adapter) |
| **Auth** | Clerk (Authentication & Route Middleware) |
| **Styling** | Tailwind CSS 4 + custom animations |
| **UI Effects** | Framer Motion, custom ReactBits components (SoftAurora, SpotlightCard) |

---

## Key Features

1. **Grounded Document Ingestion (RAG)**: Drag and drop a financial PDF (earnings report) or chart image. The text is parsed dynamically (using `pdf-parse`) or visually summarized (using Groq Vision) and fed into the decision node.
2. **Batch Stock Research**: Enter a comma-separated list of companies (e.g. `AAPL, MSFT, TSLA`). The agent processes them sequentially to respect API rate limits, streaming progress updates to a live batch loader.
3. **Comparison Leaderboard Dashboard**: Renders a side-by-side comparison matrix of researched companies (PE, growth, margin, moat, risk level), allowing you to star assets directly to your Watchlist or place virtual mock BUY orders.
4. **Devil's Advocate Node**: An adversarial node that critique's the bull thesis, identifying loopholes in the model and adjusting the confidence score.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Clone and Install

```bash
git clone https://github.com/harshavardhankumar29/StockAgent.git
cd StockAgent
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file for Next.js runtime:

```env
# Clerk Authentication (https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Groq LLM (https://console.groq.com)
GROQ_API_KEY=gsk_...

# Tavily Search (https://app.tavily.com)
TAVILY_API_KEY=tvly-...

# NewsAPI (https://newsapi.org/register)
NEWS_API_KEY=...

# Alpha Vantage (https://www.alphavantage.co/support/#api-key) — OPTIONAL
ALPHA_VANTAGE_API_KEY=...
```

Create a `.env` file in the root for Prisma build config:

```env
DATABASE_URL="postgresql://neondb_owner:npg_...aws.neon.tech/neondb?sslmode=require"
```

### 3. Synchronize Database Schema

Sync the Prisma models (Prisma Pg adapter) with your database instance:

```bash
npx prisma db push
npx prisma generate
```

### 4. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start researching.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── research/
│   │   │   ├── route.ts         # SSE streaming research endpoint
│   │   │   ├── batch/route.ts   # Sequential batch research endpoint
│   │   │   └── upload/route.ts  # PDF text & Groq Vision file uploads
│   │   ├── history/route.ts     # Saved research reports CRUD
│   │   ├── portfolio/route.ts   # Virtual portfolio orders
│   │   └── watchlist/route.ts   # Watchlist stars and real-time feeds
│   ├── portfolio/               # Holdings & total PnL view
│   ├── watchlist/               # Starred tickers feed
│   ├── research/
│   │   ├── [company]/           # Single company analysis & report
│   │   ├── batch/               # Live batch research loader screen
│   │   └── compare/             # Leaderboard comparison matrix
│   └── page.tsx                 # Home screen search
├── components/
│   ├── HeroSearch.tsx           # Drag-and-drop file upload search bar
│   ├── InvestmentReport.tsx     # Custom SVG charting, critique & chat
│   └── reactbits/               # Matte cards & animated UI layout
├── lib/
│   ├── agent/
│   │   ├── graph.ts             # LangGraph state machine (8 nodes)
│   │   └── schemas.ts           # Zod structured outputs
│   └── db.ts                    # PostgreSQL Prisma Client
└── .npmrc                       # Peer dependency config for Next 16/React 19
```

---

## Production Deployment Notes (Vercel)

- **Peer Dependency Resolution**: Ensure a `.npmrc` file is committed with `legacy-peer-deps=true` to prevent dependency conflicts during Vercel's installation process.
- **Build Step**: The build command is updated in `package.json` to `"prisma generate && next build"` to ensure the Prisma Client is generated inside the serverless runtime before Next compiles the pages.
- **Database URL**: Set the `DATABASE_URL` environment variable inside Vercel's environment settings.

---

## License

MIT
