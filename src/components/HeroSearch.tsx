import React, { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import DecryptedText from "./reactbits/DecryptedText";
import ShinyText from "./reactbits/ShinyText";

export default function HeroSearch({ onResearch }: { onResearch: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const popularStocks = [
    { emoji: '🟢', name: 'NVIDIA', ticker: 'NVDA' },
    { emoji: '🍎', name: 'Apple', ticker: 'AAPL' },
    { emoji: '⚡', name: 'Tesla', ticker: 'TSLA' },
    { emoji: '📦', name: 'Amazon', ticker: 'AMZN' },
    { emoji: '🔍', name: 'Google', ticker: 'GOOG' },
    { emoji: '💜', name: 'Meta', ticker: 'META' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onResearch(query.trim());
    }
  };

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Headline */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald/5 border border-emerald/10 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-emerald font-semibold font-mono">AI-Powered Research</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight flex items-center justify-center gap-3 md:gap-4 text-white leading-[1.1]">
          <DecryptedText 
            text="Invest" 
            speed={60} 
            maxIterations={15} 
            sequential={true} 
            animateOn="view"
            className="text-white font-black"
            encryptedClassName="text-emerald/60"
          />
          <ShinyText 
            text="Smarter" 
            speed={2.5} 
            color="#10b981" 
            shineColor="#06b6d4" 
            spread={100}
            className="font-black"
          />
        </h1>
        <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
          Autonomous AI agents analyzing financials, sentiment, competitive moats, and risk — all in real-time.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="w-full max-w-xl group">
        <div className={`relative p-[1px] rounded-2xl transition-all duration-500 ${
          isFocused 
            ? 'bg-gradient-to-r from-emerald/50 via-cyan/50 to-indigo/50 shadow-[0_0_40px_rgba(16,185,129,0.12)]' 
            : 'bg-border'
        }`}>
          <div className="flex items-center bg-surface rounded-2xl px-5 py-3.5">
            <Search className={`mr-3 transition-colors duration-300 ${isFocused ? 'text-emerald' : 'text-slate-600'}`} size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Search any company or ticker..."
              className="bg-transparent outline-none w-full text-white placeholder:text-slate-600 text-sm font-medium"
            />
            {query.trim() && (
              <button 
                type="submit"
                className="ml-2 p-2 rounded-xl bg-emerald/10 hover:bg-emerald/20 text-emerald transition-all duration-200 cursor-pointer"
              >
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Popular Chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {popularStocks.map((s) => (
          <button
            key={s.ticker}
            onClick={() => onResearch(s.name)}
            className="flex items-center gap-1.5 bg-surface/60 border border-border px-3 py-1.5 rounded-full hover:border-border-hover hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
          >
            <span className="text-xs">{s.emoji}</span>
            <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">
              <DecryptedText 
                text={s.name} 
                animateOn="hover" 
                speed={40} 
                maxIterations={6}
                useOriginalCharsOnly
              />
            </span>
            <span className="text-[10px] font-mono text-slate-600">{s.ticker}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
