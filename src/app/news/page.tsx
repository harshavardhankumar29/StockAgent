"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Show, UserButton, SignInButton } from "@clerk/nextjs";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { TrendingUp, TrendingDown, Newspaper, Zap, ExternalLink } from "lucide-react";
import TickerTape from "@/components/TickerTape";

const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  publishedAtRelative: string;
  urlToImage: string | null;
}

interface StockQuote {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  up: boolean;
}

export default function NewsPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [gainers, setGainers] = useState<StockQuote[]>([]);
  const [losers, setLosers] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNewsData = async () => {
      try {
        const res = await fetch("/api/market-news");
        if (!res.ok) throw new Error("Failed to load news");
        const data = await res.json();
        setArticles(data.news || []);
        setGainers(data.gainers || []);
        setLosers(data.losers || []);
      } catch (err) {
        console.error("Error loading market news:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNewsData();
  }, []);



  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start overflow-x-hidden bg-base">
      {/* SoftAurora Background */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <SoftAurora 
          color1="#06b6d4" 
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
          <Link href="/news" className="text-xs text-emerald transition-colors font-semibold">
            Market News
          </Link>
          <Show when="signed-in">
            <Link href="/history" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              History
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

      {/* Page Body Grid */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-[110px] pb-16 flex-1 flex flex-col md:flex-row gap-8 justify-start">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-32 gap-4 animate-fade-in">
            <div className="w-8 h-8 border-2 border-emerald/20 border-t-emerald rounded-full animate-spin" />
            <span className="text-slate-600 text-xs font-mono">Loading market updates...</span>
          </div>
        ) : (
          <>
            {/* Left Column: News Articles */}
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald/10 to-cyan/10 flex items-center justify-center border border-emerald/10">
                  <Newspaper className="w-4 h-4 text-emerald" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-white tracking-tight">Stocks in News Today</h1>
                  <p className="text-[11px] text-slate-500 font-medium">Real-time business and macroeconomic updates</p>
                </div>
              </div>

              <div className="space-y-4">
                {articles.map((item, index) => (
                  <div
                    key={index}
                    className="opacity-0 animate-fade-up"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <SpotlightCard
                        spotlightColor="rgba(16, 185, 129, 0.05)"
                        className="bg-surface/50 border border-border rounded-xl hover:border-border-hover transition-all duration-300"
                      >
                        <div className="p-5 flex flex-col md:flex-row gap-5">
                          {/* Image Placeholder/Image if present */}
                          {item.urlToImage && (
                            <div className="w-full md:w-32 h-20 rounded-lg overflow-hidden shrink-0 bg-slate-900 border border-border">
                              <img 
                                src={item.urlToImage} 
                                alt={item.title} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                              />
                            </div>
                          )}
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-white/[0.03] border border-border px-2 py-0.5 rounded text-slate-500 font-semibold uppercase tracking-wider font-mono">
                                {item.source}
                              </span>
                              <span className="text-[10px] text-slate-600 font-mono">
                                {item.publishedAtRelative}
                              </span>
                            </div>
                            <h3 className="font-bold text-white text-sm leading-snug group-hover:text-emerald transition-colors flex items-start gap-1.5 justify-between">
                              {item.title}
                              <ExternalLink size={12} className="text-slate-700 shrink-0 group-hover:text-emerald transition-colors" />
                            </h3>
                            {item.description && (
                              <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </SpotlightCard>
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Gainers & Losers */}
            <div className="w-full md:w-80 shrink-0 space-y-6">
              {/* Gainers block */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Top Gainers Today</h2>
                  <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
                </div>
                <div className="space-y-2.5">
                  {gainers.map((g) => (
                    <SpotlightCard
                      key={g.symbol}
                      spotlightColor="rgba(16, 185, 129, 0.06)"
                      className="bg-surface/40 border border-border p-3.5 rounded-xl cursor-pointer hover:border-slate-800 transition-all duration-300"
                    >
                      <div className="flex justify-between items-center" onClick={() => router.push(`/research/${g.symbol}`)}>
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-xs font-bold text-white truncate">{g.name}</p>
                          <span className="text-[10px] font-mono text-slate-600">{g.symbol}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono font-bold text-white">${g.price}</p>
                          <span className="text-[10px] font-mono font-semibold text-emerald flex items-center justify-end gap-0.5">
                            <TrendingUp size={10} /> +{g.changePercent}%
                          </span>
                        </div>
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              </div>

              {/* Losers block */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Top Losers Today</h2>
                  <span className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
                </div>
                <div className="space-y-2.5">
                  {losers.map((l) => (
                    <SpotlightCard
                      key={l.symbol}
                      spotlightColor="rgba(239, 68, 68, 0.06)"
                      className="bg-surface/40 border border-border p-3.5 rounded-xl cursor-pointer hover:border-slate-800 transition-all duration-300"
                    >
                      <div className="flex justify-between items-center" onClick={() => router.push(`/research/${l.symbol}`)}>
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-xs font-bold text-white truncate">{l.name}</p>
                          <span className="text-[10px] font-mono text-slate-600">{l.symbol}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono font-bold text-white">${l.price}</p>
                          <span className="text-[10px] font-mono font-semibold text-crimson flex items-center justify-end gap-0.5">
                            <TrendingDown size={10} /> {l.changePercent}%
                          </span>
                        </div>
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              </div>
            </div>
          </>
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
