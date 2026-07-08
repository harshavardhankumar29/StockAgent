/**
 * Financial analysis helpers including programmatic DCF and technical indicators
 */

export interface DCFResult {
  wacc: string;
  growthRate: string;
  intrinsicValue: string;
  currentPrice: string;
  upside: string;
  isUndervalued: boolean;
  error?: string;
}

export interface MACDResult {
  macd: string;
  signal: string;
  histogram: string;
  sentiment: 'Bullish Crossover' | 'Bearish Crossover';
}

export interface TechIndicators {
  sma50: string;
  sma200: string;
  rsi14: string;
  macd: MACDResult | null;
}

/**
 * Calculates a simplified 2-stage Discounted Cash Flow (DCF) valuation model.
 */
export function calculateDCF(financials: any, stats: any): DCFResult {
  try {
    const fcf = financials.freeCashflow;
    const cash = financials.totalCash || 0;
    const debt = financials.totalDebt || 0;
    const currentPrice = financials.currentPrice;
    const shares = stats.sharesOutstanding;

    if (!fcf || fcf <= 0 || !shares || !currentPrice) {
      return {
        wacc: "N/A",
        growthRate: "N/A",
        intrinsicValue: "N/A",
        currentPrice: currentPrice ? currentPrice.toFixed(2) : "N/A",
        upside: "N/A",
        isUndervalued: false,
        error: "DCF not applicable due to negative/missing cash flows or missing shares data."
      };
    }

    // CAPM Cost of Equity as WACC proxy
    const beta = stats.beta || 1.0;
    const riskFreeRate = 0.04; // 4% Treasury rate
    const equityRiskPremium = 0.055; // 5.5% historical risk premium
    const wacc = riskFreeRate + beta * equityRiskPremium;

    // Growth rate estimation based on revenue growth
    let growthRate = financials.revenueGrowth || 0.10; // default 10%
    if (growthRate < 0.02) growthRate = 0.05; // floor at 5% for mature growth projection
    if (growthRate > 0.25) growthRate = 0.20; // cap at 20% for conservative projections

    const terminalGrowthRate = 0.025; // 2.5% perpetual growth matching long-term GDP

    // 5-Year Forecast
    const cashFlows: number[] = [];
    const discountedCashFlows: number[] = [];
    let currentFCF = fcf;

    for (let year = 1; year <= 5; year++) {
      currentFCF = currentFCF * (1 + growthRate);
      cashFlows.push(currentFCF);

      const discounted = currentFCF / Math.pow(1 + wacc, year);
      discountedCashFlows.push(discounted);
    }

    const sumDiscountedFCF = discountedCashFlows.reduce((a, b) => a + b, 0);

    // Terminal Value
    const terminalValue = (cashFlows[4] * (1 + terminalGrowthRate)) / (wacc - terminalGrowthRate);
    const discountedTerminalValue = terminalValue / Math.pow(1 + wacc, 5);

    // Intrinsic Equity Value
    const enterpriseValue = sumDiscountedFCF + discountedTerminalValue;
    const equityValue = enterpriseValue + cash - debt;
    const intrinsicValuePerShare = equityValue / shares;

    const upside = ((intrinsicValuePerShare - currentPrice) / currentPrice) * 100;

    return {
      wacc: (wacc * 100).toFixed(2) + "%",
      growthRate: (growthRate * 100).toFixed(2) + "%",
      intrinsicValue: intrinsicValuePerShare.toFixed(2),
      currentPrice: currentPrice.toFixed(2),
      upside: upside.toFixed(2) + "%",
      isUndervalued: intrinsicValuePerShare > currentPrice
    };
  } catch (err: any) {
    return {
      wacc: "N/A",
      growthRate: "N/A",
      intrinsicValue: "N/A",
      currentPrice: "N/A",
      upside: "N/A",
      isUndervalued: false,
      error: "Error calculating DCF model: " + err.message
    };
  }
}

// ─────────────────────────────────────────────
// Technical Indicators Calculations
// ─────────────────────────────────────────────

export function calculateSMA(prices: number[], period: number): string {
  if (prices.length < period) return "N/A";
  const sum = prices.slice(prices.length - period).reduce((a, b) => a + b, 0);
  return (sum / period).toFixed(2);
}

export function calculateRSI(prices: number[], period = 14): string {
  if (prices.length <= period) return "N/A";
  
  let gains = 0;
  let losses = 0;

  // First RSI value
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smoothed RSI for the rest of the array
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }

  if (avgLoss === 0) return "100.00";
  const rs = avgGain / avgLoss;
  return (100 - 100 / (1 + rs)).toFixed(2);
}

function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const ema = [prices.slice(0, period).reduce((a, b) => a + b, 0) / period];
  
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

export function calculateMACD(prices: number[]): MACDResult | null {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  if (ema12.length === 0 || ema26.length === 0) return null;
  
  // Align lengths
  const macdLine: number[] = [];
  const offset = ema12.length - ema26.length;
  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }
  
  const signalLine = calculateEMA(macdLine, 9);
  if (signalLine.length === 0) return null;
  
  const latestMacd = macdLine[macdLine.length - 1];
  const latestSignal = signalLine[signalLine.length - 1];
  
  return {
    macd: latestMacd.toFixed(3),
    signal: latestSignal.toFixed(3),
    histogram: (latestMacd - latestSignal).toFixed(3),
    sentiment: latestMacd > latestSignal ? 'Bullish Crossover' : 'Bearish Crossover'
  };
}
