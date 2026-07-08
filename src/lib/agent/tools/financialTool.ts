import { tool } from "@langchain/core/tools";
import { z } from "zod";
import YahooFinance from "yahoo-finance2";

// Instantiate the Yahoo Finance client
const yahooFinance = new YahooFinance();

// Yahoo Finance - completely free, no API key needed!
export const financialDataTool = tool(
  async ({ ticker }: { ticker: string }) => {
    try {
      // Get quote data
      const quoteResult = await yahooFinance.quote(ticker);
      const summary = await yahooFinance.quoteSummary(ticker, {
        modules: [
          "summaryProfile",
          "financialData",
          "defaultKeyStatistics",
          "recommendationTrend",
        ],
      });

      const financialData = {
        symbol: quoteResult.symbol,
        currentPrice: quoteResult.regularMarketPrice,
        marketCap: quoteResult.marketCap,
        peRatio: quoteResult.trailingPE,
        forwardPE: quoteResult.forwardPE,
        priceToBook: quoteResult.priceToBook,
        revenueGrowth: summary.financialData?.revenueGrowth,
        profitMargin: summary.financialData?.profitMargins,
        operatingMargin: summary.financialData?.operatingMargins,
        debtToEquity: summary.financialData?.debtToEquity,
        freeCashFlow: summary.financialData?.freeCashflow,
        returnOnEquity: summary.financialData?.returnOnEquity,
        returnOnAssets: summary.financialData?.returnOnAssets,
        currentRatio: summary.financialData?.currentRatio,
        fiftyTwoWeekHigh: quoteResult.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quoteResult.fiftyTwoWeekLow,
        analystRating:
          summary.financialData?.recommendationKey || "No rating",
        sector: summary.summaryProfile?.sector,
        industry: summary.summaryProfile?.industry,
        employees: summary.summaryProfile?.fullTimeEmployees,
        description: summary.summaryProfile?.longBusinessSummary,
        website: summary.summaryProfile?.website,
        country: summary.summaryProfile?.country,
      };

      return JSON.stringify(financialData);
    } catch (error) {
      console.error("Yahoo Finance failed, trying Alpha Vantage:", error);
      // Fallback to Alpha Vantage free tier
      return await alphaVantageBackup(ticker);
    }
  },
  {
    name: "get_financial_data",
    description:
      "Get real financial data for a company using its ticker symbol",
    schema: z.object({
      ticker: z
        .string()
        .describe("The stock ticker symbol (e.g., AAPL, TSLA)"),
    }),
  }
);

// Alpha Vantage backup - 25 free requests/day
async function alphaVantageBackup(ticker: string): Promise<string> {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) {
      return JSON.stringify({
        error: "No Alpha Vantage API key configured",
        symbol: ticker,
      });
    }

    const response = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${apiKey}`
    );
    const data = await response.json();

    if (data.Symbol) {
      return JSON.stringify({
        symbol: data.Symbol,
        marketCap: data.MarketCapitalization,
        peRatio: data.PERatio,
        profitMargin: data.ProfitMargin,
        revenueGrowth: data.QuarterlyRevenueGrowthYOY,
        debtToEquity: data.DebtToEquityRatio,
        sector: data.Sector,
        industry: data.Industry,
        description: data.Description,
        analystRating: data.AnalystTargetPrice,
      });
    }
    return "Financial data unavailable";
  } catch {
    return "Financial data unavailable";
  }
}

// Tool to find ticker from company name
export const tickerLookupTool = tool(
  async ({ companyName }: { companyName: string }) => {
    try {
      const results = await yahooFinance.search(companyName);
      if (results.quotes && results.quotes.length > 0) {
        const topResults = results.quotes.slice(0, 3).map(
          (q) => ({
            symbol: q.symbol,
            name: ("longname" in q ? q.longname : "") || ("shortname" in q ? q.shortname : ""),
            exchange: "exchange" in q ? q.exchange : "",
            type: "quoteType" in q ? q.quoteType : "",
          })
        );
        return JSON.stringify(topResults);
      }
      return JSON.stringify([]);
    } catch {
      return JSON.stringify([]);
    }
  },
  {
    name: "lookup_ticker",
    description: "Find the stock ticker symbol for a company name",
    schema: z.object({
      companyName: z.string().describe("The company name to search for"),
    }),
  }
);
