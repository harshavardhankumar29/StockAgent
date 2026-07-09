"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Show, UserButton, SignInButton } from "@clerk/nextjs";
import { Zap } from "lucide-react";
import TickerTape from "@/components/TickerTape";
import ResearchLoader from "@/components/ResearchLoader";
import InvestmentReport from "@/components/InvestmentReport";
import type { DecisionData } from "@/lib/types/agent.types";

const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

const RESEARCH_STEPS = [
  "identify_company",
  "financial_research",
  "news_research",
  "competitive_analysis",
  "risk_assessment",
  "devil_critique",
  "decision"
];

export default function ResearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ id?: string; contextId?: string }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const companyName = decodeURIComponent(resolvedParams.company);
  const historyId = resolvedSearchParams.id;
  const contextId = resolvedSearchParams.contextId;
  const router = useRouter();

  const [steps, setSteps] = useState<Map<string, "running" | "complete" | "pending">>(
    new Map(RESEARCH_STEPS.map((s) => [s, "pending"]))
  );
  const [decision, setDecision] = useState<DecisionData | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState("Initializing agent...");
  const [timer, setTimer] = useState(0);

  const hasFetched = useRef(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer count
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Stop timer count when finished
  useEffect(() => {
    if (isComplete && timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  }, [isComplete]);

  // Execute SSE connection or load from history
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    if (historyId) {
      const loadFromHistory = async () => {
        try {
          setCurrentMessage("Loading saved report...");
          const res = await fetch(`/api/history?id=${historyId}`);
          if (!res.ok) throw new Error("Failed to load saved report.");
          const record = await res.json();
          
          const mappedDecision: DecisionData = {
            decision: record.decision as "INVEST" | "PASS",
            confidenceScore: record.confidenceScore,
            ticker: record.ticker,
            reasoning: record.reasoning,
            financialHealth: record.financialHealth || "N/A",
            moatStrength: record.moatStrength || "N/A",
            growthProspects: record.growthProspects || "N/A",
            riskLevel: record.riskLevel || "N/A",
            timeHorizon: record.timeHorizon || "N/A",
            keyMetrics: JSON.parse(record.keyMetrics || "{}"),
            bullPoints: JSON.parse(record.bullPoints || "[]"),
            bearPoints: JSON.parse(record.bearPoints || "[]"),
            chartData: record.chartData || "[]",
            competitorMetrics: record.competitorMetrics || "[]",
            critique: record.critique || "",
          };

          
          setDecision(mappedDecision);
          setIsComplete(true);
          setSteps(new Map(RESEARCH_STEPS.map((s) => [s, "complete"])));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to load history.";
          setError(msg);
        }
      };
      loadFromHistory();
      return;
    }

    const executeResearch = async () => {
      try {
        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName,
            uploadedContextId: contextId || ""
          }),
        });

        if (!response.ok) throw new Error("Failed to initialize search agent.");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("Null response stream reader");

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6).trim();
            } else if (line === "" && eventType && eventData) {
              try {
                const parsed = JSON.parse(eventData);
                handleStreamEvent(eventType, parsed);
              } catch {
                // Skip errors
              }
              eventType = "";
              eventData = "";
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Pipeline execution failed.";
        setError(msg);
      }
    };

    const handleStreamEvent = (type: string, data: Record<string, unknown>) => {
      switch (type) {
        case "progress":
          setSteps((prev) => {
            const next = new Map(prev);
            if (data.status === "running") {
              next.set(data.step as string, "running");
            } else if (data.status === "complete") {
              next.set(data.step as string, "complete");
            }
            return next;
          });
          setCurrentMessage(data.message as string);
          break;

        case "decision": {
          const decisionData = data as unknown as DecisionData;
          setDecision(decisionData);
          if (decisionData.id) {
            router.replace(`/research/${encodeURIComponent(companyName)}?id=${decisionData.id}`, { scroll: false });
          }
          break;
        }

        case "complete":
          setIsComplete(true);
          setSteps(new Map(RESEARCH_STEPS.map((s) => [s, "complete"])));
          break;

        case "error":
          setError(data.message as string);
          break;
      }
    };

    executeResearch();
  }, [companyName, historyId, router]);

  const handleReset = () => {
    router.push("/");
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start overflow-x-hidden bg-base">
      {/* SoftAurora Background */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <SoftAurora 
          color1="#06b6d4"
          color2="#6366f1"
          speed={0.7}
          scale={1.3}
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
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleReset}>
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
            <Link href="/watchlist" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              Watchlist
            </Link>
            <Link href="/portfolio" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              Portfolio
            </Link>
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

      <div className={`relative z-10 w-full mx-auto px-4 pt-[110px] pb-20 ${
        decision ? "max-w-none xl:px-10 2xl:px-16" : "max-w-5xl"
      }`}>
        {!decision ? (
          <ResearchLoader
            company={companyName}
            steps={steps}
            timer={timer}
            currentMessage={currentMessage}
            error={error}
          />
        ) : (
          <InvestmentReport
            data={decision}
            onReset={handleReset}
          />
        )}
      </div>
    </main>
  );
}
