"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Shield, AlertTriangle, Loader2, Plus, Star, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

interface ComparisonRecord {
  id: string;
  companyName: string;
  ticker: string;
  decision: "INVEST" | "PASS";
  confidenceScore: number;
  reasoning: string;
  keyMetrics: any; // parsed JSON
  financialHealth: string;
  moatStrength: string;
  riskLevel: string;
  timeHorizon: string;
}

function CompareLeaderboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") || "";

  const [records, setRecords] = useState<ComparisonRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Watchlist items cache
  const [watchlistTickers, setWatchlistTickers] = useState<Set<string>>(new Set());
  const [watchlistLoadingTicker, setWatchlistLoadingTicker] = useState<string | null>(null);

  // Portfolio Transaction state
  const [tradingRecord, setTradingRecord] = useState<ComparisonRecord | null>(null);
  const [tradeShares, setTradeShares] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const list = await res.json();
        setWatchlistTickers(new Set(list.map((item: any) => item.ticker)));
      }
    } catch (e) {
      console.warn("Failed to fetch watchlist:", e);
    }
  };

  useEffect(() => {
    if (!idsParam) {
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        const res = await fetch(`/api/history?ids=${idsParam}`);
        if (res.ok) {
          const rawList = await res.json();
          const parsed = rawList.map((item: any) => ({
            ...item,
            keyMetrics: JSON.parse(item.keyMetrics || "{}"),
          }));
          
          // Sort: INVEST first, then by Confidence Score descending
          parsed.sort((a: any, b: any) => {
            if (a.decision === "INVEST" && b.decision !== "INVEST") return -1;
            if (a.decision !== "INVEST" && b.decision === "INVEST") return 1;
            return b.confidenceScore - a.confidenceScore;
          });

          setRecords(parsed);
        }
      } catch (err) {
        console.error("Failed to load comparison list:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
    fetchWatchlist();
  }, [idsParam]);

  const handleWatchlistToggle = async (ticker: string) => {
    setWatchlistLoadingTicker(ticker);
    try {
      const isAdded = watchlistTickers.has(ticker);
      if (isAdded) {
        const res = await fetch(`/api/watchlist?ticker=${ticker}`, { method: "DELETE" });
        if (res.ok) {
          setWatchlistTickers(prev => {
            const next = new Set(prev);
            next.delete(ticker);
            return next;
          });
        }
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker, companyName: ticker }),
        });
        if (res.ok) {
          setWatchlistTickers(prev => {
            const next = new Set(prev);
            next.add(ticker);
            return next;
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setWatchlistLoadingTicker(null);
    }
  };

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradingRecord) return;
    setTradeLoading(true);
    setTradeError(null);

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: tradingRecord.ticker,
          companyName: tradingRecord.companyName,
          type: "BUY",
          shares: parseFloat(tradeShares),
          price: parseFloat(tradePrice),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to buy stock");

      setTradeShares("");
      setTradePrice("");
      setTradingRecord(null);
      router.push("/portfolio");
    } catch (err: any) {
      setTradeError(err.message);
    } finally {
      setTradeLoading(false);
    }
  };

  const openTradeModal = (record: ComparisonRecord) => {
    const currentPrice = record.keyMetrics?.currentPrice?.replace("$", "").replace(",", "") || "";
    setTradePrice(currentPrice);
    setTradeShares("10");
    setTradingRecord(record);
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start overflow-x-hidden bg-base">
      {/* SoftAurora Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <SoftAurora
          color1="#10b981"
          color2="#06b6d4"
          speed={0.7}
          scale={1.3}
          brightness={0.7}
          enableMouseInteraction={true}
        />
      </div>

      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />

      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-40 bg-base/80 backdrop-blur-md border-b border-border py-3 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/")}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald to-cyan flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-white font-mono tracking-tight">
            StockAgent<span className="text-emerald">.AI</span>
          </span>
        </div>
        <Link
          href="/"
          className="flex items-center text-xs text-slate-400 hover:text-white transition-colors gap-1.5 font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </header>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-[100px] pb-20 flex flex-col justify-start">
        
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">
            Batch Comparison Leaderboard
          </h1>
          <p className="text-slate-400 text-sm">
            Side-by-side ranking matrix. Sorts by recommendations (INVEST first) and confidence score.
          </p>
        </div>

        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan" />
          </div>
        ) : records.length === 0 ? (
          <SpotlightCard className="bg-surface/50 border border-border rounded-xl p-8 text-center min-h-[200px] flex items-center justify-center">
            <p className="text-slate-500 text-sm">No comparison records found.</p>
          </SpotlightCard>
        ) : (
          <div className="space-y-6">
            
            {/* Quick Summary Cards (Side-by-side Top Picks) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {records.slice(0, 3).map((r, idx) => {
                const isInvest = r.decision === "INVEST";
                return (
                  <SpotlightCard
                    key={r.id}
                    spotlightColor={isInvest ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)"}
                    className={`bg-surface/60 border p-5 rounded-xl flex flex-col justify-between min-h-[160px] ${
                      idx === 0 && isInvest ? "border-emerald/40 shadow-[0_0_20px_rgba(16,185,129,0.05)]" : "border-border"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-mono font-bold text-white">{r.ticker}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Rank #{idx + 1}</span>
                      </div>
                      <span className={`inline-block text-[9px] uppercase tracking-wider font-bold mb-3 ${
                        isInvest ? "text-emerald" : "text-slate-500"
                      }`}>
                        {r.decision} Verdict ({r.confidenceScore}%)
                      </span>
                      <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{r.reasoning}</p>
                    </div>

                    <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-border/20">
                      <span className="text-[10px] text-slate-500 font-mono">Moat: {r.moatStrength}</span>
                      <Link
                        href={`/research/${r.ticker}?id=${r.id}`}
                        className="text-[10px] text-cyan hover:underline font-bold font-mono"
                      >
                        Read Report →
                      </Link>
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>

            {/* Comparison Grid Table */}
            <SpotlightCard className="bg-surface/60 border border-border rounded-xl p-5 md:p-6 overflow-hidden">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center font-mono">
                <BarChart3 className="w-3.5 h-3.5 text-cyan mr-1.5" /> Full Comparison Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/50 text-[9px] text-slate-500 uppercase">
                      <th className="py-2.5">Asset</th>
                      <th className="py-2.5 text-center">Verdict</th>
                      <th className="py-2.5 text-center">PE Ratio</th>
                      <th className="py-2.5 text-center">Profit Margin</th>
                      <th className="py-2.5 text-center">Rev Growth</th>
                      <th className="py-2.5 text-center">Moat</th>
                      <th className="py-2.5 text-center">Risk</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 text-slate-300">
                    {records.map((r) => {
                      const isInvest = r.decision === "INVEST";
                      const isWatchlisted = watchlistTickers.has(r.ticker);
                      return (
                        <tr key={r.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3.5">
                            <span className="font-bold text-white block">{r.ticker}</span>
                            <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">
                              {r.companyName}
                            </span>
                          </td>
                          <td className="py-3.5 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isInvest ? "bg-emerald/10 text-emerald" : "bg-slate-800 text-slate-400"
                            }`}>
                              {r.decision} ({r.confidenceScore}%)
                            </span>
                          </td>
                          <td className="py-3.5 text-center text-slate-300">
                            {r.keyMetrics?.peRatio || "N/A"}
                          </td>
                          <td className="py-3.5 text-center text-slate-300">
                            {r.keyMetrics?.profitMargin || "N/A"}
                          </td>
                          <td className="py-3.5 text-center text-slate-300">
                            {r.keyMetrics?.revenueGrowth || "N/A"}
                          </td>
                          <td className="py-3.5 text-center">
                            <span className="flex items-center justify-center text-[10px]">
                              <Shield className={`w-3 h-3 mr-1 ${r.moatStrength === "Wide" ? "text-emerald" : "text-slate-600"}`} />
                              {r.moatStrength}
                            </span>
                          </td>
                          <td className="py-3.5 text-center">
                            <span className="flex items-center justify-center text-[10px]">
                              <AlertTriangle className={`w-3 h-3 mr-1 ${r.riskLevel === "High" ? "text-crimson" : "text-amber"}`} />
                              {r.riskLevel}
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Watchlist Toggle */}
                              <button
                                onClick={() => handleWatchlistToggle(r.ticker)}
                                disabled={watchlistLoadingTicker === r.ticker}
                                className={`p-1.5 rounded-lg border transition-all duration-300 cursor-pointer ${
                                  isWatchlisted
                                    ? "bg-emerald/10 border-emerald/20 text-emerald"
                                    : "bg-white/[0.01] border-border text-slate-500 hover:text-white"
                                }`}
                              >
                                {watchlistLoadingTicker === r.ticker ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Star className="w-3.5 h-3.5 fill-current" />
                                )}
                              </button>

                              {/* Portfolio Order */}
                              {isInvest && (
                                <button
                                  onClick={() => openTradeModal(r)}
                                  className="px-2 py-1 rounded-lg bg-cyan/10 border border-cyan/20 text-cyan text-[10px] font-bold hover:bg-cyan/20 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Buy
                                </button>
                              )}

                              {/* Details Link */}
                              <Link
                                href={`/research/${r.ticker}?id=${r.id}`}
                                className="px-2 py-1 rounded-lg bg-white/[0.03] border border-border text-slate-400 text-[10px] hover:text-white transition-colors"
                              >
                                Report
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SpotlightCard>
          </div>
        )}

        {/* Paper Trade Modal */}
        {tradingRecord && (
          <div className="fixed inset-0 z-50 bg-base/80 backdrop-blur-sm flex items-center justify-center p-4">
            <SpotlightCard className="bg-surface border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 font-mono">
                Order Virtual Paper Trade
              </h3>
              {tradeError && (
                <div className="bg-crimson/10 border border-crimson/30 text-crimson px-3 py-2 rounded-lg text-xs mb-4">
                  {tradeError}
                </div>
              )}
              <form onSubmit={handleTradeSubmit} className="space-y-4 text-xs font-sans">
                <div className="flex justify-between items-center bg-white/[0.02] border border-border/50 p-3 rounded-lg">
                  <div>
                    <span className="text-base font-bold text-white font-mono">{tradingRecord.ticker}</span>
                    <span className="text-[10px] text-slate-500 block">{tradingRecord.companyName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Rating</span>
                    <span className="text-emerald text-xs font-bold uppercase">{tradingRecord.decision} ({tradingRecord.confidenceScore}%)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Buy Shares</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={tradeShares}
                      onChange={(e) => setTradeShares(e.target.value)}
                      placeholder="10"
                      className="w-full bg-white/[0.02] border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan/50"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Price Per Share ($)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={tradePrice}
                      onChange={(e) => setTradePrice(e.target.value)}
                      className="w-full bg-white/[0.02] border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan/50"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setTradingRecord(null)}
                    className="px-4 py-2 border border-border rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={tradeLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald to-cyan text-white font-semibold rounded-lg shadow-md hover:scale-102 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {tradeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm BUY order
                  </button>
                </div>
              </form>
            </SpotlightCard>
          </div>
        )}
      </div>
    </main>
  );
}

export default function CompareLeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan" />
      </div>
    }>
      <CompareLeaderboardContent />
    </Suspense>
  );
}
