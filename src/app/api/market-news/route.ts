import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

interface StockQuote {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  up: boolean;
}

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  publishedAtRelative: string;
  urlToImage: string | null;
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export async function GET() {
  try {
    // 1. Fetch Top Gainers & Losers from Yahoo Finance quote endpoint
    const tickers = ["AAPL", "MSFT", "GOOG", "AMZN", "NVDA", "META", "TSLA", "NFLX", "AMD", "AVGO", "QCOM", "INTC"];
    let gainers: StockQuote[] = [];
    let losers: StockQuote[] = [];

    try {
      const yf = new yahooFinance();
      const quotes = await yf.quote(tickers);
      
      const formatted: StockQuote[] = quotes.map(q => ({
        symbol: q.symbol,
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice ? q.regularMarketPrice.toFixed(2) : "N/A",
        change: q.regularMarketChange ? q.regularMarketChange.toFixed(2) : "0.00",
        changePercent: q.regularMarketChangePercent ? q.regularMarketChangePercent.toFixed(2) : "0.00",
        up: (q.regularMarketChangePercent || 0) >= 0
      }));

      // Sort by changePercent desc to get gainers/losers
      const sorted = [...formatted].sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent));
      gainers = sorted.slice(0, 4);
      losers = [...sorted].reverse().slice(0, 4);
    } catch (e) {
      console.warn("⚠️ Failed to fetch market quotes:", e);
    }

    // 2. Fetch Business/Stock News via NewsAPI
    const newsApiKey = process.env.NEWS_API_KEY;
    let newsArticles: NewsArticle[] = [];

    if (newsApiKey) {
      try {
        const newsRes = await fetch(
          `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=15&apiKey=${newsApiKey}`,
          { next: { revalidate: 300 } } // Cache for 5 mins
        );
        const newsData = await newsRes.json();
        
        if (newsData.articles) {
          newsArticles = newsData.articles.map((a: { title: string; description?: string; content?: string; url: string; source?: { name?: string }; publishedAt: string; urlToImage?: string | null }): NewsArticle => ({
            title: a.title,
            description: a.description || a.content || "",
            url: a.url,
            source: a.source?.name || "News",
            publishedAt: a.publishedAt,
            publishedAtRelative: formatRelativeTime(a.publishedAt),
            urlToImage: a.urlToImage || null,
          }));
        }
      } catch (newsErr) {
        console.error("❌ Failed to fetch NewsAPI headlines:", newsErr);
      }
    }

    // Fallback news articles if NewsAPI fails or has no key
    if (newsArticles.length === 0) {
      const now = new Date();
      newsArticles = [
        {
          title: "Federal Reserve signals potential rate cuts later this year",
          description: "Fed officials suggest inflation is moving closer to target, opening the door for upcoming monetary policy relaxation.",
          url: "https://finance.yahoo.com",
          source: "Yahoo Finance",
          publishedAt: now.toISOString(),
          publishedAtRelative: "Just now",
          urlToImage: null
        },
        {
          title: "NVIDIA market cap rises as tech demand sustains momentum",
          description: "Hardware shipments and enterprise AI infrastructure orders drive chipmaker valuation to record highs.",
          url: "https://finance.yahoo.com",
          source: "Bloomberg",
          publishedAt: new Date(now.getTime() - 3600000).toISOString(),
          publishedAtRelative: "1h ago",
          urlToImage: null
        },
        {
          title: "S&P 500 reaches new highs led by growth sector rotation",
          description: "Broad-based indices index gains as institutional investors rebalance tech and industrials portfolios.",
          url: "https://finance.yahoo.com",
          source: "Reuters",
          publishedAt: new Date(now.getTime() - 7200000).toISOString(),
          publishedAtRelative: "2h ago",
          urlToImage: null
        }
      ];
    }

    return NextResponse.json({
      news: newsArticles,
      gainers,
      losers
    });
  } catch (error) {
    console.error("❌ Failed to load market news route:", error);
    return NextResponse.json({ error: "Failed to load market news" }, { status: 500 });
  }
}
