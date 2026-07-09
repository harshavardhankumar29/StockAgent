import { NextRequest, NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query.trim() || query.length < 2) {
      return NextResponse.json([]);
    }

    const yf = new yahooFinance();
    const results = await yf.search(query);

    // Map and filter quotes that have symbol, prioritize Yahoo Finance quotes
    const suggestions = (results.quotes || [])
      .filter((q) => q.symbol && q.isYahooFinance)
      .slice(0, 6) // limit to top 6 suggestions
      .map((q) => ({
        symbol: q.symbol,
        name: ("longname" in q ? q.longname : "") || ("shortname" in q ? q.shortname : q.symbol),
        exchange: "exchange" in q ? q.exchange : "N/A",
        type: "quoteType" in q ? q.quoteType : "EQUITY",
      }));

    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error("❌ Suggest API error:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
