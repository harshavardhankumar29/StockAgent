"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, TrendingUp, Zap, HelpCircle } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

interface TickerProgress {
  ticker: string;
  currentStep: string;
  stepMessage: string;
  status: "pending" | "running" | "complete" | "failed";
  decision?: "INVEST" | "PASS";
  confidenceScore?: number;
}

function BatchResearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tickersParam = searchParams.get("tickers") || "";

  const [tickerList, setTickerList] = useState<string[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, TickerProgress>>({});
  const [globalMessage, setGlobalMessage] = useState("Initializing batch research pipeline...");
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!tickersParam) {
      setError("No tickers provided for batch research.");
      return;
    }

    const list = tickersParam.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
    setTickerList(list);

    // Initialize progress map
    const initialMap: Record<string, TickerProgress> = {};
    list.forEach(ticker => {
      initialMap[ticker] = {
        ticker,
        currentStep: "pending",
        stepMessage: "Waiting in queue...",
        status: "pending"
      };
    });
    setProgressMap(initialMap);
  }, [tickersParam]);

  // Timer Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // SSE Stream Effect
  useEffect(() => {
    if (tickerList.length === 0) return;

    const startStream = async () => {
      try {
        const response = await fetch("/api/research/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companies: tickerList })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Batch request failed");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("Could not initialize stream reader");

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            const eventMatch = line.match(/^event:\s*(.+)$/m);
            const dataMatch = line.match(/^data:\s*(.+)$/m);

            if (eventMatch && dataMatch) {
              const eventType = eventMatch[1].trim();
              const eventData = JSON.parse(dataMatch[1].trim());

              if (eventType === "start") {
                setGlobalMessage(eventData.message);
              } else if (eventType === "company_start") {
                setGlobalMessage(eventData.message);
                setProgressMap(prev => ({
                  ...prev,
                  [eventData.company]: {
                    ...prev[eventData.company],
                    status: "running",
                    currentStep: "identify_company",
                    stepMessage: "🔍 Initializing research..."
                  }
                }));
              } else if (eventType === "progress") {
                setProgressMap(prev => ({
                  ...prev,
                  [eventData.company]: {
                    ...prev[eventData.company],
                    status: "running",
                    currentStep: eventData.step,
                    stepMessage: eventData.message
                  }
                }));
              } else if (eventType === "company_decision") {
                setProgressMap(prev => ({
                  ...prev,
                  [eventData.company]: {
                    ...prev[eventData.company],
                    decision: eventData.decision,
                    confidenceScore: eventData.confidenceScore
                  }
                }));
              } else if (eventType === "company_complete") {
                setProgressMap(prev => ({
                  ...prev,
                  [eventData.company]: {
                    ...prev[eventData.company],
                    status: "complete",
                    stepMessage: "🟢 Complete"
                  }
                }));
              } else if (eventType === "company_error") {
                setProgressMap(prev => ({
                  ...prev,
                  [eventData.company]: {
                    ...prev[eventData.company],
                    status: "failed",
                    stepMessage: `🔴 Error: ${eventData.message}`
                  }
                }));
              } else if (eventType === "complete") {
                setGlobalMessage(eventData.message);
                const reportIds = eventData.reportIds || [];
                // Redirect to comparison dashboard!
                setTimeout(() => {
                  router.push(`/research/compare?ids=${reportIds.join(",")}`);
                }, 2000);
              } else if (eventType === "error") {
                setError(eventData.message);
              }
            }
          }
        }
      } catch (err: any) {
        console.error("SSE Error:", err);
        setError(err.message || "Batch research request failed.");
      }
    };

    startStream();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [tickerList, router]);

  const formatTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start overflow-x-hidden bg-base">
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
      </header>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 pt-[100px] pb-20 flex flex-col justify-start">
        
        {/* Headline */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-white">
            Batch Research in Progress
          </h1>
          <p className="text-slate-500 font-mono text-[11px] uppercase tracking-wider flex items-center justify-center gap-2">
            <span>Running for {formatTime(timer)}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
          </p>
          <p className="text-slate-400 text-xs mt-3 bg-surface/50 border border-border px-4 py-2 rounded-xl max-w-md mx-auto">
            {error ? <span className="text-crimson">{error}</span> : globalMessage}
          </p>
        </div>

        {/* Progress List */}
        <div className="space-y-3">
          {tickerList.map((ticker) => {
            const progress = progressMap[ticker];
            if (!progress) return null;

            const isPending = progress.status === "pending";
            const isRunning = progress.status === "running";
            const isComplete = progress.status === "complete";
            const isFailed = progress.status === "failed";

            return (
              <SpotlightCard
                key={ticker}
                spotlightColor="rgba(6, 182, 212, 0.05)"
                className={`bg-surface/50 border p-4 rounded-xl flex items-center justify-between gap-4 transition-all duration-300 ${
                  isRunning ? "border-cyan/40 bg-surface" : "border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-mono font-bold text-white">{ticker}</span>
                    {isRunning && (
                      <span className="text-[8px] bg-cyan/10 text-cyan px-2 py-0.5 rounded font-mono font-bold uppercase animate-pulse">
                        Active Node
                      </span>
                    )}
                    {isComplete && (
                      <span className={`text-[8px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                        progress.decision === "INVEST" ? "bg-emerald/10 text-emerald" : "bg-slate-800 text-slate-400"
                      }`}>
                        {progress.decision} ({progress.confidenceScore}%)
                      </span>
                    )}
                  </div>
                  <span className={`text-xs block ${isRunning ? "text-cyan" : "text-slate-500"}`}>
                    {progress.stepMessage}
                  </span>
                </div>

                <div className="shrink-0">
                  {isPending && <div className="w-5 h-5 rounded-full border border-slate-800" />}
                  {isRunning && <Loader2 className="w-5 h-5 animate-spin text-cyan" />}
                  {isComplete && <CheckCircle2 className="w-5 h-5 text-emerald" />}
                  {isFailed && <AlertCircle className="w-5 h-5 text-crimson" />}
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default function BatchResearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-base flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan" />
      </div>
    }>
      <BatchResearchContent />
    </Suspense>
  );
}
