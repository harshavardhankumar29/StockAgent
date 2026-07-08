"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Plus,
  Loader2,
  DollarSign,
  Briefcase,
  Zap,
  Activity
} from "lucide-react";
import dynamic from "next/dynamic";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

interface HoldingItem {
  ticker: string;
  companyName: string;
  shares: number;
  totalCost: number;
  averageBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  totalProfit: number;
  totalProfitPercent: number;
}

interface PortfolioData {
  holdings: HoldingItem[];
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  totalProfitPercent: number;
}

export default function PortfolioPage() {
  const router = useRouter();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  // New Transaction Form State
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"BUY" | "SELL">("BUY");
  const [formTicker, setFormTicker] = useState("");
  const [formShares, setFormShares] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch("/api/portfolio");
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
      }
    } catch (e) {
      console.error("Failed to load portfolio:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: formTicker.toUpperCase().trim(),
          companyName: formTicker.toUpperCase().trim(),
          type: formType,
          shares: parseFloat(formShares),
          price: parseFloat(formPrice),
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to record transaction");
      }

      // Reset form and reload portfolio
      setFormTicker("");
      setFormShares("");
      setFormPrice("");
      setShowForm(false);
      fetchPortfolio();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const totalIsUp = (data?.totalProfit || 0) >= 0;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start overflow-x-hidden bg-base">
      {/* SoftAurora Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <SoftAurora
          color1="#06b6d4"
          color2="#6366f1"
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
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 pt-[100px] pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-2">
              Virtual Portfolio
            </h1>
            <p className="text-slate-400 text-sm">
              Track mock trades recommended by StockAgent and monitor your returns relative to cost basis.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center self-start md:self-auto gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald to-cyan text-white shadow-lg shadow-cyan/15 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Transaction
          </button>
        </div>

        {/* Form Modal/Section */}
        {showForm && (
          <SpotlightCard className="bg-surface/90 border border-border p-6 rounded-xl mb-6 max-w-lg mx-auto">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Record Transaction
            </h3>
            {formError && (
              <div className="bg-crimson/10 border border-crimson/30 text-crimson px-3 py-2 rounded-lg text-xs mb-4">
                {formError}
              </div>
            )}
            <form onSubmit={handleTransactionSubmit} className="space-y-4 font-sans text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormType("BUY")}
                  className={`flex-1 py-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                    formType === "BUY"
                      ? "bg-emerald/10 border-emerald text-emerald"
                      : "bg-white/[0.01] border-border text-slate-400"
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setFormType("SELL")}
                  className={`flex-1 py-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                    formType === "SELL"
                      ? "bg-crimson/10 border-crimson text-crimson"
                      : "bg-white/[0.01] border-border text-slate-400"
                  }`}
                >
                  SELL
                </button>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Stock Ticker</label>
                <input
                  type="text"
                  required
                  value={formTicker}
                  onChange={(e) => setFormTicker(e.target.value)}
                  placeholder="e.g. AAPL"
                  className="w-full bg-white/[0.02] border border-border rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Shares Count</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formShares}
                    onChange={(e) => setFormShares(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full bg-white/[0.02] border border-border rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Price Per Share ($)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="e.g. 182.50"
                    className="w-full bg-white/[0.02] border border-border rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan/50"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-border rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald to-cyan text-white font-semibold rounded-lg shadow-md hover:scale-102 active:scale-98 transition-all disabled:opacity-40 cursor-pointer"
                >
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Transaction
                </button>
              </div>
            </form>
          </SpotlightCard>
        )}

        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan" />
          </div>
        ) : !data || data.holdings.length === 0 ? (
          <SpotlightCard className="bg-surface/50 border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[220px]">
            <Briefcase className="w-10 h-10 text-slate-600 mb-4 opacity-50" />
            <h3 className="text-base font-bold text-white mb-1">Your portfolio is empty</h3>
            <p className="text-slate-500 text-xs max-w-sm mb-4 leading-normal">
              Record a virtual BUY order to populate this dashboard and monitor paper trading metrics.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gradient-to-r from-emerald to-cyan text-white text-xs font-semibold rounded-lg shadow-lg hover:shadow-cyan/15 transition-all cursor-pointer"
            >
              Add Your First Transaction
            </button>
          </SpotlightCard>
        ) : (
          <div className="space-y-6">
            {/* Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SpotlightCard
                spotlightColor="rgba(6, 182, 212, 0.08)"
                className="bg-surface/60 border border-border p-5 rounded-xl"
              >
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  Portfolio Value
                </span>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-5 h-5 text-cyan" />
                  <span className="text-2xl font-mono font-bold text-white">
                    {data.totalValue.toLocaleString()}
                  </span>
                </div>
              </SpotlightCard>

              <SpotlightCard
                spotlightColor="rgba(148, 163, 184, 0.05)"
                className="bg-surface/60 border border-border p-5 rounded-xl"
              >
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  Total Cost Basis
                </span>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-5 h-5 text-slate-500" />
                  <span className="text-2xl font-mono font-bold text-white">
                    {data.totalCost.toLocaleString()}
                  </span>
                </div>
              </SpotlightCard>

              <SpotlightCard
                spotlightColor={totalIsUp ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)"}
                className="bg-surface/60 border border-border p-5 rounded-xl"
              >
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  Total P/L
                </span>
                <div className="flex items-center gap-2">
                  {totalIsUp ? (
                    <TrendingUp className="w-5 h-5 text-emerald" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-crimson" />
                  )}
                  <span
                    className={`text-2xl font-mono font-bold ${
                      totalIsUp ? "text-emerald" : "text-crimson"
                    }`}
                  >
                    ${data.totalProfit.toLocaleString()} ({totalIsUp ? "+" : ""}
                    {data.totalProfitPercent}%)
                  </span>
                </div>
              </SpotlightCard>
            </div>

            {/* Holdings Table */}
            <SpotlightCard className="bg-surface/60 border border-border rounded-xl p-5 md:p-6 overflow-hidden">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center font-mono">
                <Activity className="w-3.5 h-3.5 text-cyan mr-1.5" /> Current Asset Allocation
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/50 text-[9px] text-slate-500 uppercase">
                      <th className="py-2">Asset</th>
                      <th className="py-2 text-right">Shares</th>
                      <th className="py-2 text-right">Avg Cost</th>
                      <th className="py-2 text-right">Current Price</th>
                      <th className="py-2 text-right">Market Value</th>
                      <th className="py-2 text-right">Returns</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 text-slate-300">
                    {data.holdings.map((h) => {
                      const isUp = h.totalProfit >= 0;
                      return (
                        <tr key={h.ticker} className="hover:bg-white/[0.01]">
                          <td className="py-3">
                            <span className="font-bold text-white block">{h.ticker}</span>
                            <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">
                              {h.companyName}
                            </span>
                          </td>
                          <td className="py-3 text-right">{h.shares.toFixed(2)}</td>
                          <td className="py-3 text-right">${h.averageBuyPrice.toFixed(2)}</td>
                          <td className="py-3 text-right">${h.currentPrice.toFixed(2)}</td>
                          <td className="py-3 text-right font-semibold text-white">
                            ${h.currentValue.toLocaleString()}
                          </td>
                          <td
                            className={`py-3 text-right font-semibold ${
                              isUp ? "text-emerald" : "text-crimson"
                            }`}
                          >
                            ${h.totalProfit.toLocaleString()} ({isUp ? "+" : ""}
                            {h.totalProfitPercent}%)
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
      </div>
    </main>
  );
}
