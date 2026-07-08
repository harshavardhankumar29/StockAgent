"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Search, LineChart, Loader2, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

interface WatchlistItem {
  id: string;
  ticker: string;
  companyName: string;
  price: number | null;
  changePercent: number | null;
}

export default function WatchlistPage() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingTicker, setDeletingTicker] = useState<string | null>(null);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
      }
    } catch (e) {
      console.error("Failed to load watchlist:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleDelete = async (ticker: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingTicker(ticker);
    try {
      const res = await fetch(`/api/watchlist?ticker=${ticker}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWatchlist((prev) => prev.filter((item) => item.ticker !== ticker));
      }
    } catch (err) {
      console.error("Failed to delete watchlist item:", err);
    } finally {
      setDeletingTicker(null);
    }
  };

  const handleRunResearch = (ticker: string) => {
    router.push(`/research/${encodeURIComponent(ticker)}`);
  };

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
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">
            Your Watchlist
          </h1>
          <p className="text-slate-400 text-sm">
            Stocks you are monitoring. Audit real-time changes and run research in one-click.
          </p>
        </div>

        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan" />
          </div>
        ) : watchlist.length === 0 ? (
          <SpotlightCard className="bg-surface/50 border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[220px]">
            <Search className="w-10 h-10 text-slate-600 mb-4 opacity-50" />
            <h3 className="text-base font-bold text-white mb-1">Your watchlist is empty</h3>
            <p className="text-slate-500 text-xs max-w-sm mb-4 leading-normal">
              Search for stocks on the home dashboard and click the "Watchlist" button to add them here.
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-gradient-to-r from-emerald to-cyan text-white text-xs font-semibold rounded-lg shadow-lg hover:shadow-cyan/15 transition-all cursor-pointer"
            >
              Search Stocks
            </button>
          </SpotlightCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {watchlist.map((item) => {
              const isUp = item.changePercent !== null && item.changePercent >= 0;
              return (
                <SpotlightCard
                  key={item.id}
                  spotlightColor="rgba(6, 182, 212, 0.08)"
                  className="bg-surface/60 border border-border p-5 rounded-xl flex items-center justify-between gap-4 group hover:border-cyan/30 transition-all duration-300"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xl font-mono font-bold text-white block mb-0.5">
                      {item.ticker}
                    </span>
                    <span className="text-xs text-slate-500 block truncate max-w-[200px]">
                      {item.companyName}
                    </span>
                  </div>

                  <div className="text-right">
                    {item.price !== null ? (
                      <>
                        <span className="text-lg font-mono font-bold text-white block">
                          ${item.price.toFixed(2)}
                        </span>
                        <span
                          className={`text-xs font-mono font-medium ${
                            isUp ? "text-emerald" : "text-crimson"
                          }`}
                        >
                          {isUp ? "+" : ""}
                          {item.changePercent?.toFixed(2)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-600 text-xs font-mono">N/A</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunResearch(item.ticker)}
                      title="Run Full Research Pipeline"
                      className="p-2 rounded-lg bg-cyan/10 border border-cyan/20 text-cyan hover:bg-cyan/20 transition-colors cursor-pointer"
                    >
                      <LineChart className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(item.ticker, e)}
                      disabled={deletingTicker === item.ticker}
                      title="Delete from Watchlist"
                      className="p-2 rounded-lg bg-crimson/10 border border-crimson/20 text-crimson hover:bg-crimson/20 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {deletingTicker === item.ticker ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
