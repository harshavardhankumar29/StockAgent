"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Show, UserButton, SignInButton, useUser, useClerk } from "@clerk/nextjs";
import TickerTape from "@/components/TickerTape";
import HeroSearch from "@/components/HeroSearch";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { Zap, Shield, BarChart3, Newspaper } from "lucide-react";

const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const handleResearch = (name: string) => {
    if (!isSignedIn) {
      openSignIn({
        fallbackRedirectUrl: `/research/${encodeURIComponent(name)}`
      });
      return;
    }
    router.push(`/research/${encodeURIComponent(name)}`);
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between overflow-x-hidden bg-base">
      {/* SoftAurora Background */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <SoftAurora 
          color1="#10b981" 
          color2="#6366f1"
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
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald to-cyan flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-white font-mono tracking-tight">
            StockAgent<span className="text-emerald">.AI</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/news" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
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

      {/* Centered Hero View */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 flex-1 flex flex-col justify-center items-center pt-32 pb-16 min-h-[70vh]">
        <HeroSearch onResearch={handleResearch} />
      </div>



      {/* Signed Out — Features Showcase */}
      <Show when="signed-out">
        <section className="relative z-10 w-full max-w-5xl mx-auto px-4 py-16">
          <div className="text-center space-y-3 mb-10">
            <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-emerald font-semibold">
              How It Works
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Four Research Pipelines, One Decision
            </h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto">
              Each analysis runs through specialized AI agents that gather data, analyze patterns, and synthesize findings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="opacity-0 animate-fade-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
              <SpotlightCard spotlightColor="rgba(16, 185, 129, 0.08)" className="bg-surface/40 border border-border p-5 rounded-xl hover:border-border-hover transition-all duration-300 h-full">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald/10 flex items-center justify-center border border-emerald/15">
                    <BarChart3 className="w-4 h-4 text-emerald" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Financial Analysis</h3>
                  <p className="text-slate-500 text-[11px] leading-relaxed">Balance sheets, revenue growth, P/E ratios, free cash flow, and profit margins from live market data.</p>
                </div>
              </SpotlightCard>
            </div>

            <div className="opacity-0 animate-fade-up" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
              <SpotlightCard spotlightColor="rgba(6, 182, 212, 0.08)" className="bg-surface/40 border border-border p-5 rounded-xl hover:border-border-hover transition-all duration-300 h-full">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan/10 flex items-center justify-center border border-cyan/15">
                    <Newspaper className="w-4 h-4 text-cyan" />
                  </div>
                  <h3 className="font-bold text-white text-sm">News Sentiment</h3>
                  <p className="text-slate-500 text-[11px] leading-relaxed">Real-time scanning of media coverage and market announcements using LLM-based sentiment analysis.</p>
                </div>
              </SpotlightCard>
            </div>

            <div className="opacity-0 animate-fade-up" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
              <SpotlightCard spotlightColor="rgba(99, 102, 241, 0.08)" className="bg-surface/40 border border-border p-5 rounded-xl hover:border-border-hover transition-all duration-300 h-full">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo/10 flex items-center justify-center border border-indigo/15">
                    <Shield className="w-4 h-4 text-indigo" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Competitive Moats</h3>
                  <p className="text-slate-500 text-[11px] leading-relaxed">Industry landscape mapping, competitor analysis, pricing power, and sustainable advantage assessment.</p>
                </div>
              </SpotlightCard>
            </div>

            <div className="opacity-0 animate-fade-up" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
              <SpotlightCard spotlightColor="rgba(245, 158, 11, 0.08)" className="bg-surface/40 border border-border p-5 rounded-xl hover:border-border-hover transition-all duration-300 h-full">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center border border-amber/15">
                    <Zap className="w-4 h-4 text-amber" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Risk Assessment</h3>
                  <p className="text-slate-500 text-[11px] leading-relaxed">Identifies regulatory risks, debt exposure, market headwinds, and assigns a severity rating.</p>
                </div>
              </SpotlightCard>
            </div>
          </div>
        </section>
      </Show>

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
