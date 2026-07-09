"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Show, UserButton, SignInButton, useUser, useClerk } from "@clerk/nextjs";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { TrendingUp, TrendingDown, Clock, Search as SearchIcon, ArrowLeft, Zap, Trash2 } from "lucide-react";
import TickerTape from "@/components/TickerTape";

const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

interface ResearchHistoryRecord {
  id: string;
  userId: string;
  companyName: string;
  ticker: string;
  decision: string;
  confidenceScore: number;
  reasoning: string;
  keyMetrics: string;
  bullPoints: string;
  bearPoints: string;
  createdAt: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const [history, setHistory] = useState<ResearchHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const handleResearch = (name: string, id: string) => {
    router.push(`/research/${encodeURIComponent(name)}?id=${id}`);
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear your entire research history? This cannot be undone.")) return;
    
    try {
      setLoading(true);
      const res = await fetch("/api/history", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear history");
      setHistory([]);
    } catch (err) {
      console.error("Error clearing history:", err);
      alert("Failed to clear history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this research report?")) return;
    
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete report");
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Error deleting report:", err);
      alert("Failed to delete report. Please try again.");
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      openSignIn({
        fallbackRedirectUrl: "/history"
      });
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      fetch("/api/history", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setHistory(data);
        })
        .catch((err) => console.error("Error fetching history:", err))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [isSignedIn, isLoaded, openSignIn]);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start overflow-x-hidden bg-base">
      {/* SoftAurora Background */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <SoftAurora 
          color1="#6366f1" 
          color2="#10b981"
          speed={0.6}
          scale={1.2}
          brightness={0.7}
          enableMouseInteraction={true}
        />
      </div>

      {/* Ambient Backgrounds */}
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />

      {/* Ticker Tape */}
      <div className="fixed top-0 left-0 w-full z-50">
        <TickerTape />
      </div>

      {/* Header/Navbar */}
      <header className="fixed top-[27px] left-0 w-full z-40 bg-base/85 backdrop-blur-2xl border-b border-border py-3 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/")}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald to-cyan flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-white font-mono tracking-tight">
            StockAgent<span className="text-emerald">.AI</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
            Search
          </Link>
          <Link href="/news" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
            Market News
          </Link>
          <Show when="signed-in">
            <Link href="/watchlist" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              Watchlist
            </Link>
            <Link href="/portfolio" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              Portfolio
            </Link>
          </Show>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald/10 border border-emerald/20 text-emerald hover:bg-emerald/20 transition-all cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>

      </header>

      {/* Main Content Area */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-[110px] pb-16 flex-1 flex flex-col justify-start">
        {/* Navigation Link back */}
        <div className="mb-6">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft size={14} /> Back to Search
          </Link>
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-border pb-5 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo/10 to-emerald/10 flex items-center justify-center border border-indigo/10">
              <Clock className="w-4 h-4 text-indigo" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Saved Research Reports</h1>
              <p className="text-[11px] text-slate-500 font-medium">Browse and review all past stock analyses</p>
            </div>
          </div>
          {history.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-crimson/10 border border-crimson/20 text-crimson hover:bg-crimson/25 transition-all text-[10px] font-semibold cursor-pointer"
              >
                <Trash2 size={11} /> Clear All History
              </button>
              <span className="text-[10px] font-mono text-slate-400 bg-surface px-3 py-1.5 rounded-lg border border-border">
                {history.length} report{history.length !== 1 ? "s" : ""} saved
              </span>
            </div>
          )}
        </div>

        {/* Content list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
            <div className="w-8 h-8 border-2 border-emerald/20 border-t-emerald rounded-full animate-spin" />
            <span className="text-slate-600 text-xs font-mono">Loading saved reports...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 gap-6 animate-fade-in text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-inner">
              <SearchIcon className="w-6 h-6 text-slate-600" />
            </div>
            <div className="space-y-2">
              <p className="text-slate-300 font-semibold text-base">Your history is currently empty</p>
              <p className="text-slate-500 text-xs max-w-sm leading-relaxed">
                Run an autonomous research query on the home search page. Once the agent makes its final investment decision, it will be saved here automatically.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="mt-2 px-5 py-2.5 rounded-xl bg-emerald hover:bg-emerald/80 text-white text-xs font-bold transition-all shadow-[0_0_30px_rgba(16,185,129,0.15)] cursor-pointer"
            >
              Analyze a Stock Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {history.map((item, index) => {
              const isInvest = item.decision === "INVEST";
              const confidence = item.confidenceScore || 0;

              return (
                <div
                  key={item.id}
                  className="opacity-0 animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                >
                  <SpotlightCard
                    spotlightColor={isInvest ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"}
                    className="bg-surface/60 border border-border rounded-xl cursor-pointer hover:border-border-hover transition-all duration-300 group h-full flex flex-col"
                  >
                    <div
                      onClick={() => handleResearch(item.companyName, item.id)}
                      className="p-4 flex flex-col gap-3 flex-1 justify-between"
                    >
                      <div>
                        {/* Title section */}
                        <div className="flex justify-between items-start mb-1">
                          <div className="min-w-0 flex-1 mr-3">
                            <h3 className="font-bold text-white text-sm truncate group-hover:text-emerald transition-colors">
                              {item.companyName}
                            </h3>
                            <span className="text-[10px] font-mono text-slate-500">{item.ticker}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded-md font-bold uppercase tracking-wider ${
                              isInvest
                                ? "bg-emerald/8 text-emerald border border-emerald/15"
                                : "bg-crimson/8 text-crimson border border-crimson/15"
                            }`}>
                              {isInvest ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                              {item.decision}
                            </span>
                            <button
                              onClick={(e) => handleDeleteRecord(e, item.id)}
                              title="Delete this report"
                              className="p-1 rounded bg-white/[0.02] hover:bg-crimson/10 border border-border/40 hover:border-crimson/30 text-slate-500 hover:text-crimson transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Reasoning */}
                        {item.reasoning && (
                          <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 mt-2 mb-1">
                            {item.reasoning}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Confidence bar */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold">Confidence</span>
                            <span className="text-[11px] font-mono font-bold text-slate-300">{confidence}%</span>
                          </div>
                          <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                isInvest
                                  ? "bg-gradient-to-r from-emerald/80 to-cyan/80"
                                  : "bg-gradient-to-r from-crimson/80 to-orange-500/80"
                              }`}
                              style={{ width: `${confidence}%` }}
                            />
                          </div>
                        </div>

                        {/* Card footer */}
                        <div className="pt-2.5 border-t border-border/30 flex justify-between items-center">
                          <span className="text-[10px] text-slate-700 font-mono">
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-[10px] text-emerald opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium">
                            View Report →
                          </span>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-border/30 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald to-cyan flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">
              StockAgent<span className="text-emerald">.AI</span>
            </span>
          </div>
          <p className="text-slate-700 text-[10px] font-mono">
            Not financial advice · For educational purposes only
          </p>
        </div>
      </footer>
    </main>
  );
}
