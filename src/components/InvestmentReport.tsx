import React, { useState, useEffect } from "react";
import { ArrowRight, TrendingUp, TrendingDown, Shield, AlertTriangle } from "lucide-react";
import type { DecisionData } from "@/lib/types/agent.types";
import SpotlightCard from "./reactbits/SpotlightCard";

interface InvestmentReportProps {
  data: DecisionData;
  onReset: () => void;
}

export default function InvestmentReport({ data, onReset }: InvestmentReportProps) {
  const isInvest = data.decision === 'INVEST';
  const [dashOffset, setDashOffset] = useState(283);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const score = data.confidenceScore || 0;
      const offset = 283 - (283 * (score / 100));
      setDashOffset(offset);
    }, 100);
    return () => clearTimeout(timeout);
  }, [data.confidenceScore]);

  const metrics = data.keyMetrics || {
    peRatio: "N/A",
    revenueGrowth: "N/A",
    profitMargin: "N/A",
    debtLevel: "N/A"
  };

  return (
    <div className="space-y-6 py-8 max-w-4xl mx-auto animate-fade-in">
      {/* Hero Verdict Card */}
      <div className={`relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br ${
        isInvest 
          ? 'from-emerald/20 via-transparent to-cyan/10' 
          : 'from-crimson/20 via-transparent to-orange-500/10'
      }`}>
        <SpotlightCard
          spotlightColor={isInvest ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}
          className="bg-surface rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 border-none"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              {isInvest ? <TrendingUp className="text-emerald w-4 h-4" /> : <TrendingDown className="text-crimson w-4 h-4" />}
              <span className={`font-mono text-[10px] uppercase tracking-[0.15em] font-bold ${
                isInvest ? 'text-emerald' : 'text-crimson'
              }`}>
                Final Verdict
              </span>
            </div>
            <h2 className={`text-5xl md:text-6xl font-black tracking-tighter mb-3 ${
              isInvest ? 'text-emerald' : 'text-crimson'
            }`}>
              {data.decision}
            </h2>
            <p className="text-slate-400 leading-relaxed text-sm max-w-lg">{data.reasoning}</p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-5">
              {data.moatStrength && (
                <span className="flex items-center text-[10px] bg-white/[0.03] border border-border px-2.5 py-1 rounded-md text-slate-400 font-medium">
                  <Shield className="w-3 h-3 mr-1 text-emerald" /> {data.moatStrength} Moat
                </span>
              )}
              {data.riskLevel && (
                <span className="flex items-center text-[10px] bg-white/[0.03] border border-border px-2.5 py-1 rounded-md text-slate-400 font-medium">
                  <AlertTriangle className="w-3 h-3 mr-1 text-amber" /> {data.riskLevel} Risk
                </span>
              )}
              {data.financialHealth && (
                <span className="text-[10px] bg-white/[0.03] border border-border px-2.5 py-1 rounded-md text-slate-400 font-medium">
                  Health: <span className="text-white">{data.financialHealth}</span>
                </span>
              )}
            </div>
          </div>

          {/* Confidence Ring */}
          <div className="relative w-32 h-32 md:w-36 md:h-36 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.03)" strokeWidth="5" fill="none" />
              <circle
                cx="50" cy="50" r="45"
                stroke={isInvest ? '#10b981' : '#ef4444'}
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-mono font-bold text-white">{data.confidenceScore}</span>
              <span className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Confidence</span>
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* Financial Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(metrics).map(([key, val]) => (
          <SpotlightCard
            key={key}
            spotlightColor="rgba(6, 182, 212, 0.08)"
            className="bg-surface/60 border border-border p-4 rounded-xl hover:border-border-hover transition-all duration-300"
          >
            <span className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold block mb-1">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <p className="text-xl font-mono font-bold text-white">{val as string || "N/A"}</p>
          </SpotlightCard>
        ))}
      </div>

      {/* Bull & Bear Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SpotlightCard
          spotlightColor="rgba(16, 185, 129, 0.1)"
          className="bg-surface/60 border border-border rounded-xl overflow-hidden"
        >
          <div className="bg-emerald/[0.03] px-4 py-2.5 border-b border-border flex items-center">
            <TrendingUp className="w-3.5 h-3.5 text-emerald mr-2" />
            <h3 className="font-bold text-emerald text-[10px] uppercase tracking-wider">Bull Case</h3>
          </div>
          <ul className="p-4 space-y-2.5">
            {(data.bullPoints || []).map((b: string, i: number) => (
              <li key={i} className="flex items-start">
                <span className="w-4 h-4 rounded-md bg-emerald/8 text-emerald flex items-center justify-center mt-0.5 mr-2.5 flex-shrink-0 text-[10px]">✓</span>
                <span className="text-slate-400 text-xs leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </SpotlightCard>

        <SpotlightCard
          spotlightColor="rgba(239, 68, 68, 0.1)"
          className="bg-surface/60 border border-border rounded-xl overflow-hidden"
        >
          <div className="bg-crimson/[0.03] px-4 py-2.5 border-b border-border flex items-center">
            <TrendingDown className="w-3.5 h-3.5 text-crimson mr-2" />
            <h3 className="font-bold text-crimson text-[10px] uppercase tracking-wider">Bear Case</h3>
          </div>
          <ul className="p-4 space-y-2.5">
            {(data.bearPoints || []).map((b: string, i: number) => (
              <li key={i} className="flex items-start">
                <span className="w-4 h-4 rounded-md bg-crimson/8 text-crimson flex items-center justify-center mt-0.5 mr-2.5 flex-shrink-0 text-[10px] font-bold">✕</span>
                <span className="text-slate-400 text-xs leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </SpotlightCard>
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-4 pb-8">
        <button
          onClick={onReset}
          className="group flex items-center px-5 py-2.5 font-semibold text-xs bg-gradient-to-r from-emerald to-cyan text-white rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:shadow-[0_0_50px_rgba(16,185,129,0.25)] transition-all duration-300 cursor-pointer"
        >
          New Research
          <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={14} />
        </button>
      </div>
    </div>
  );
}
