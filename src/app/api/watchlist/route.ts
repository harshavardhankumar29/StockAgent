import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import YahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";

// GET /api/watchlist — Retrieve watchlisted stocks with real-time quotes
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.watchlist.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (items.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch real-time prices for watchlisted stocks
    const tickers = items.map((i) => i.ticker);
    let quotesMap: Record<string, { price: number; changePercent: number }> = {};
    
    try {
      const yf = new YahooFinance();
      const quotes = await yf.quote(tickers);
      quotes.forEach((q) => {
        quotesMap[q.symbol] = {
          price: q.regularMarketPrice || 0,
          changePercent: q.regularMarketChangePercent || 0,
        };
      });
    } catch (e) {
      console.warn("⚠️ Watchlist route failed to fetch real-time quotes:", e);
    }

    const enriched = items.map((i) => ({
      id: i.id,
      ticker: i.ticker,
      companyName: i.companyName,
      createdAt: i.createdAt,
      price: quotesMap[i.ticker]?.price || null,
      changePercent: quotesMap[i.ticker]?.changePercent || null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("❌ Watchlist GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
  }
}

// POST /api/watchlist — Add stock to watchlist
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ticker, companyName } = await request.json();
    if (!ticker || !companyName) {
      return NextResponse.json({ error: "Ticker and Company Name required" }, { status: 400 });
    }

    const item = await prisma.watchlist.upsert({
      where: {
        userId_ticker: {
          userId,
          ticker: ticker.toUpperCase(),
        },
      },
      update: {},
      create: {
        userId,
        ticker: ticker.toUpperCase(),
        companyName,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("❌ Watchlist POST failed:", error);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }
}

// DELETE /api/watchlist — Remove stock from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json({ error: "Ticker parameter required" }, { status: 400 });
    }

    await prisma.watchlist.deleteMany({
      where: {
        userId,
        ticker: ticker.toUpperCase(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Watchlist DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete watchlist item" }, { status: 500 });
  }
}
