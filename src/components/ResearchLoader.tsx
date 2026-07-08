import React from "react";
import { Brain, Check, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import DecryptedText from "./reactbits/DecryptedText";

const phases = [
  { id: 'identify_company', label: 'Identify Ticker' },
  { id: 'financial_research', label: 'Financial Analysis' },
  { id: 'news_research', label: 'News Sentiment' },
  { id: 'competitive_analysis', label: 'Competitive Moat' },
  { id: 'risk_assessment', label: 'Risk Assessment' },
  { id: 'devil_critique', label: "Devil's Advocate" },
  { id: 'decision', label: 'Final Decision' }
];

interface ResearchLoaderProps {
  company: string;
  steps: Map<string, "running" | "complete" | "pending">;
  timer: number;
  currentMessage: string;
  error: string | null;
}

export default function ResearchLoader({
  company,
  steps,
  timer,
  currentMessage,
  error
}: ResearchLoaderProps) {
  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  const completedCount = Array.from(steps.values()).filter(s => s === 'complete').length;
  const progress = (completedCount / phases.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] py-12 px-6 animate-fade-in">
      {/* Main Content */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-16 w-full max-w-3xl">
        {/* Brain Animation */}
        <div className="relative flex flex-col items-center justify-center">
          {!error ? (
            <>
              <div className="absolute w-28 h-28 rounded-full border border-emerald/10 animate-pulse-ring" />
              <div className="absolute w-20 h-20 rounded-full border border-emerald/15 animate-pulse-ring" style={{ animationDelay: '0.8s' }} />
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald/10 to-cyan/10 flex items-center justify-center backdrop-blur-md border border-emerald/20 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
                <Brain className="text-emerald animate-pulse" size={28} />
              </div>
            </>
          ) : (
            <div className="relative z-10 w-16 h-16 rounded-2xl bg-crimson/10 flex items-center justify-center backdrop-blur-md border border-crimson/20 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
              <AlertTriangle className="text-crimson" size={28} />
            </div>
          )}

          <div className="mt-6 flex flex-col items-center gap-2 text-white">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{error ? "Failed" : "Analyzing"}</span>
              <span className="font-bold text-sm text-white truncate max-w-[140px]">{company}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-crimson' : 'bg-emerald animate-pulse'}`} />
              <span className="text-[10px] text-slate-600 font-mono tabular-nums">{formatTime(timer)}</span>
            </div>
            <div className="text-slate-500 text-[11px] mt-2 max-w-[260px] text-center leading-relaxed h-10 flex items-center justify-center">
              {error ? (
                <span className="text-crimson/80">An error occurred during execution.</span>
              ) : (
                <DecryptedText
                  text={currentMessage}
                  animateOn="view"
                  speed={30}
                  maxIterations={10}
                  className="text-slate-400"
                  encryptedClassName="text-emerald/60"
                />
              )}
            </div>
          </div>
        </div>

        {/* Pipeline Steps */}
        <div className="flex flex-col gap-1 w-60">
          {/* Overall progress bar */}
          <div className="mb-4">
            <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald to-cyan transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-700 font-mono mt-1 block">{completedCount}/{phases.length} steps</span>
          </div>

          {phases.map((phase) => {
            const status = steps.get(phase.id) || "pending";
            return (
              <div key={phase.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-300 ${
                status === 'running' ? 'bg-cyan/5' : ''
              }`}>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-300 ${
                  status === "complete" ? 'bg-emerald/15 border-emerald/30' :
                  status === "running" ? 'border-cyan/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]' :
                  'border-border'
                }`}>
                  {status === "complete" ? (
                    <Check size={10} className="text-emerald" />
                  ) : status === "running" ? (
                    <Loader2 size={10} className="text-cyan animate-spin" />
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                  )}
                </div>
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  status === 'complete' ? 'text-slate-300' :
                  status === 'running' ? 'text-white' :
                  'text-slate-700'
                }`}>
                  {phase.label}
                </span>
              </div>
            );
          })}

          {error && (
            <div className="mt-4 pt-3 border-t border-border/30">
              <p className="text-crimson/80 text-[11px] leading-relaxed mb-3">{error}</p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
