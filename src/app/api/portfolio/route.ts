import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import YahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";

// GET /api/portfolio — Returns the user's current holdings and total performance
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await prisma.portfolioTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate transactions into current holdings
    const holdingsMap: Record<
      string,
      {
        ticker: string;
        companyName: string;
        shares: number;
        totalCost: number;
      }
    > = {};

    transactions.forEach((tx) => {
      const ticker = tx.ticker.toUpperCase();
      if (!holdingsMap[ticker]) {
        holdingsMap[ticker] = {
          ticker,
          companyName: tx.companyName,
          shares: 0,
          totalCost: 0,
        };
      }

      const holding = holdingsMap[ticker];
      if (tx.type === "BUY") {
        holding.shares += tx.shares;
        holding.totalCost += tx.shares * tx.price;
      } else if (tx.type === "SELL") {
        // Simple Average Cost reduction for partial sales
        const avgCost = holding.shares > 0 ? holding.totalCost / holding.shares : 0;
        holding.shares -= tx.shares;
        holding.totalCost -= tx.shares * avgCost;
      }
      
      // Clean up fractional shares or rounding errors
      if (holding.shares < 0.0001) {
        delete holdingsMap[ticker];
      }
    });

    const holdings = Object.values(holdingsMap);

    if (holdings.length === 0) {
      return NextResponse.json({ holdings: [], totalValue: 0, totalCost: 0, totalProfit: 0, totalProfitPercent: 0 });
    }

    // Fetch current prices from Yahoo Finance
    const tickers = holdings.map((h) => h.ticker);
    let quotesMap: Record<string, number> = {};
    
    try {
      const yf = new YahooFinance();
      const quotes = await yf.quote(tickers);
      quotes.forEach((q) => {
        quotesMap[q.symbol] = q.regularMarketPrice || 0;
      });
    } catch (e) {
      console.warn("⚠️ Portfolio route failed to fetch real-time quotes:", e);
    }

    let totalValue = 0;
    let totalCost = 0;

    const enrichedHoldings = holdings.map((h) => {
      const currentPrice = quotesMap[h.ticker] || h.totalCost / h.shares; // fallback to cost basis if fetch fails
      const value = h.shares * currentPrice;
      const profit = value - h.totalCost;
      const profitPercent = h.totalCost > 0 ? (profit / h.totalCost) * 100 : 0;
      
      totalValue += value;
      totalCost += h.totalCost;

      return {
        ...h,
        averageBuyPrice: Number((h.totalCost / h.shares).toFixed(2)),
        currentPrice: Number(currentPrice.toFixed(2)),
        currentValue: Number(value.toFixed(2)),
        totalProfit: Number(profit.toFixed(2)),
        totalProfitPercent: Number(profitPercent.toFixed(2)),
      };
    });

    const totalProfit = totalValue - totalCost;
    const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return NextResponse.json({
      holdings: enrichedHoldings,
      totalValue: Number(totalValue.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      totalProfitPercent: Number(totalProfitPercent.toFixed(2)),
    });
  } catch (error) {
    console.error("❌ Portfolio GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio data" }, { status: 500 });
  }
}

// POST /api/portfolio — Buy or Sell stock
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ticker, companyName, type, shares, price } = await request.json();
    if (!ticker || !companyName || !type || !shares || !price) {
      return NextResponse.json({ error: "All transaction fields required" }, { status: 400 });
    }

    if (type !== "BUY" && type !== "SELL") {
      return NextResponse.json({ error: "Type must be BUY or SELL" }, { status: 400 });
    }

    const shareCount = parseFloat(shares);
    const priceValue = parseFloat(price);

    if (isNaN(shareCount) || shareCount <= 0 || isNaN(priceValue) || priceValue <= 0) {
      return NextResponse.json({ error: "Shares and price must be positive numbers" }, { status: 400 });
    }

    // Verify user actually has enough shares to sell
    if (type === "SELL") {
      const allTx = await prisma.portfolioTransaction.findMany({
        where: { userId, ticker: ticker.toUpperCase() },
      });
      const currentShares = allTx.reduce((acc, t) => {
        return t.type === "BUY" ? acc + t.shares : acc - t.shares;
      }, 0);

      if (currentShares < shareCount) {
        return NextResponse.json({ error: `Insufficient shares. You only own ${currentShares} shares.` }, { status: 400 });
      }
    }

    const transaction = await prisma.portfolioTransaction.create({
      data: {
        userId,
        ticker: ticker.toUpperCase(),
        companyName,
        type,
        shares: shareCount,
        price: priceValue,
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("❌ Portfolio POST failed:", error);
    return NextResponse.json({ error: "Failed to add portfolio transaction" }, { status: 500 });
  }
}
