# StockAgent.AI

An AI-powered investment research agent built with **Next.js**, **LangGraph**, and **Groq**. Enter any company name and get a comprehensive investment analysis with a clear INVEST or PASS verdict — backed by real financial data, news sentiment, competitive analysis, and risk assessment.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Frontend                  │
│  HeroSearch → SSE Stream → ResearchLoader → Report  │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/research (SSE)
┌──────────────────────▼──────────────────────────────┐
│               LangGraph Agent Pipeline              │
│                                                     │
│  Node 1: Identify Company (Yahoo Finance Search)    │
│      ↓                                              │
│  Node 2: Financial Analysis (Yahoo Finance + LLM)   │
│      ↓                                              │
│  Node 3: News Research (NewsAPI + Tavily + LLM)     │
│      ↓                                              │
│  Node 4: Competitive Analysis (Tavily + LLM)        │
│      ↓                                              │
│  Node 5: Risk Assessment (Tavily + LLM)             │
│      ↓                                              │
│  Node 6: Investment Decision (Structured Output)    │
│          → Real metrics injected programmatically   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Storage: SQLite (dev) / Postgres (production)      │
│  Auth: Clerk                                        │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| AI Agent | LangGraph + LangChain |
| LLM | Groq (Llama 3.3 70B) — free tier |
| Financial Data | Yahoo Finance (free, no API key) |
| Web Search | Tavily (1,000 free searches/month) |
| News | NewsAPI (100 free requests/day) |
| Auth | Clerk |
| Database | SQLite (dev) via Prisma + better-sqlite3 |
| Styling | Tailwind CSS 4 + custom animations |
| UI Effects | Framer Motion, custom ReactBits components |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Clone and install

```bash
git clone https://github.com/harshavardhankumar29/StockAgent.git
cd StockAgent
npm install
```

### 2. Set up environment variables

Create a `.env.local` file with the following keys (all free, no credit card):

```bash
# Clerk Authentication (https://clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Groq LLM (https://console.groq.com) — 14,400 requests/day free
GROQ_API_KEY=gsk_...

# Tavily Search (https://app.tavily.com) — 1,000 searches/month free
TAVILY_API_KEY=tvly-...

# NewsAPI (https://newsapi.org/register) — 100 requests/day free (localhost only)
NEWS_API_KEY=...

# Alpha Vantage (https://www.alphavantage.co/support/#api-key) — OPTIONAL backup, 25/day free
ALPHA_VANTAGE_API_KEY=...
```

Also create a `.env` file for Prisma:

```bash
DATABASE_URL="file:./dev.db"
```

### 3. Set up the database

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start researching companies.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── research/route.ts    # SSE streaming research endpoint
│   │   ├── history/route.ts     # CRUD for saved research reports
│   │   └── market-news/route.ts # Market news + gainers/losers
│   ├── research/[company]/      # Dynamic research results page
│   ├── history/                 # Saved research history
│   ├── news/                    # Market news page
│   └── page.tsx                 # Home page with hero search
├── components/
│   ├── HeroSearch.tsx           # Animated search component
│   ├── InvestmentReport.tsx     # Full research report display
│   ├── ResearchLoader.tsx       # Step-by-step progress animation
│   ├── TickerTape.tsx           # Scrolling market ticker
│   └── reactbits/               # Custom animated UI components
├── lib/
│   ├── agent/
│   │   ├── graph.ts             # LangGraph agent pipeline (6 nodes)
│   │   └── schemas.ts           # Zod schemas for structured output
│   ├── types/agent.types.ts     # Client-side TypeScript types
│   ├── cache.ts                 # In-memory TTL cache
│   ├── rateLimit.ts             # Per-user rate limiter
│   └── db.ts                    # Prisma database client
└── proxy.ts                     # Development proxy config
```

## Key Design Decisions

- **No hallucinated numbers**: Financial metrics (P/E, margins, etc.) are fetched from Yahoo Finance and injected programmatically into the final report. The LLM only produces qualitative analysis.
- **Structured output**: The decision node uses Zod schemas with `.withStructuredOutput()` instead of fragile regex-based JSON parsing.
- **Rate limiting**: Each user is limited to 5 research requests per 10 minutes to prevent API cost overruns.
- **TTL caching**: Repeated research on the same ticker within 30 minutes uses cached data.
- **Robust retries**: LLM calls handle 429 rate limits, 5xx errors, and network timeouts with jittered exponential backoff.

## Deployment Notes

> ⚠️ **SQLite limitation**: The current SQLite setup works for local development but is ephemeral on serverless platforms (Vercel, AWS Lambda). For production, migrate to hosted Postgres (Neon/Supabase free tier) — see the TODO in `src/lib/db.ts`.

## License

MIT
