import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  Flame,
  MessageSquare,
  Send,
  Loader2,
  Printer,
  Plus,
  Check,
  Bookmark
} from "lucide-react";
import type { DecisionData } from "@/lib/types/agent.types";
import SpotlightCard from "./reactbits/SpotlightCard";

interface InvestmentReportProps {
  data: DecisionData;
  onReset: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function InvestmentReport({ data, onReset }: InvestmentReportProps) {
  const isInvest = data.decision === "INVEST";
  const [dashOffset, setDashOffset] = useState(283);

  // Watchlist state
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Hover index for SVG chart tooltip
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const score = data.confidenceScore || 0;
      const offset = 283 - (283 * (score / 100));
      setDashOffset(offset);
    }, 100);
    return () => clearTimeout(timeout);
  }, [data.confidenceScore]);

  // Check if stock is already watchlisted on mount
  useEffect(() => {
    const checkWatchlist = async () => {
      try {
        const res = await fetch("/api/watchlist");
        if (res.ok) {
          const list = await res.json();
          const found = list.some((item: any) => item.ticker === data.ticker);
          setIsWatchlisted(found);
        }
      } catch (e) {
        console.warn("Failed to check watchlist status:", e);
      }
    };
    checkWatchlist();
  }, [data.ticker]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatSending]);

  // Handle Watchlist toggle
  const handleWatchlistToggle = async () => {
    setIsWatchlistLoading(true);
    try {
      if (isWatchlisted) {
        const res = await fetch(`/api/watchlist?ticker=${data.ticker}`, {
          method: "DELETE",
        });
        if (res.ok) setIsWatchlisted(false);
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker: data.ticker,
            companyName: data.ticker, // using ticker as name fallback
          }),
        });
        if (res.ok) setIsWatchlisted(true);
      }
    } catch (e) {
      console.error("Failed to toggle watchlist:", e);
    } finally {
      setIsWatchlistLoading(false);
    }
  };

  // Handle Chat submission (streaming text)
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatSending || !data.id) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatSending(true);

    try {
      const response = await fetch("/api/research/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historyId: data.id,
          message: userMsg,
          chatHistory: chatMessages,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Null response stream reader");

      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setChatMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          const lastMsg = next[next.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            next[next.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + chunk,
            };
          }
          return next;
        });
      }
    } catch (err) {
      console.error("❌ Chat error:", err);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to connect to agent chat." },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // SVG Chart Calculation
  let chartPoints: { date: string; close: number }[] = [];
  try {
    chartPoints = JSON.parse(data.chartData || "[]");
  } catch (e) {
    console.warn("Failed to parse chartData", e);
  }

  const hasChartData = chartPoints.length > 0;
  const prices = chartPoints.map((p) => p.close);
  const minPrice = prices.length ? Math.min(...prices) * 0.99 : 0;
  const maxPrice = prices.length ? Math.max(...prices) * 1.01 : 0;

  const svgWidth = 720;
  const svgHeight = 180;
  const paddingX = 40;
  const paddingY = 20;

  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const points = chartPoints.map((p, index) => {
    const x = paddingX + (index / (chartPoints.length - 1 || 1)) * chartWidth;
    const y =
      paddingY +
      chartHeight -
      ((p.close - minPrice) / (maxPrice - minPrice || 1)) * chartHeight;
    return { x, y, date: p.date, price: p.close };
  });

  const pathD = points.length
    ? `M ${points[0].x} ${points[0].y} ` +
      points
        .slice(1)
        .map((p) => `L ${p.x} ${p.y}`)
        .join(" ")
    : "";

  const areaD = points.length
    ? `${pathD} L ${points[points.length - 1].x} ${paddingY + chartHeight} L ${points[0].x} ${paddingY + chartHeight} Z`
    : "";

  // Competitor metrics parsing
  let competitorRows: any[] = [];
  try {
    competitorRows = JSON.parse(data.competitorMetrics || "[]");
  } catch {
    // ignore
  }

  const allMetrics = [
    { label: "Current Price", value: data.keyMetrics?.currentPrice, isPrimary: true },
    { label: "Market Cap", value: data.keyMetrics?.marketCap, isPrimary: true },
    { label: "P/E Ratio", value: data.keyMetrics?.peRatio, isPrimary: true },
    { label: "Forward P/E", value: data.keyMetrics?.forwardPE },
    { label: "Revenue Growth", value: data.keyMetrics?.revenueGrowth, isPrimary: true },
    { label: "Profit Margin", value: data.keyMetrics?.profitMargin },
    { label: "Debt/Equity", value: data.keyMetrics?.debtToEquity },
    { label: "ROE", value: data.keyMetrics?.returnOnEquity },
    { label: "Free Cash Flow", value: data.keyMetrics?.freeCashFlow },
    { label: "52W High", value: data.keyMetrics?.fiftyTwoWeekHigh },
    { label: "52W Low", value: data.keyMetrics?.fiftyTwoWeekLow },
    { label: "Valuation Details", value: data.keyMetrics?.analystRating },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-4 w-full animate-fade-in print-container">
      
      {/* Left Column: Report Details */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-5">
        
        {/* Hero Verdict Card */}
        <div
          className={`relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br print:border print:p-4 ${
            isInvest
              ? "from-emerald/20 via-transparent to-cyan/10 print:border-emerald"
              : "from-crimson/20 via-transparent to-orange-500/10 print:border-crimson"
          }`}
        >
          <SpotlightCard
            spotlightColor={isInvest ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}
            className="bg-surface rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 border-none print:bg-white print:text-black"
          >
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  {isInvest ? (
                    <TrendingUp className="text-emerald w-4 h-4 print:text-green-600" />
                  ) : (
                    <TrendingDown className="text-crimson w-4 h-4 print:text-red-600" />
                  )}
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.15em] font-bold ${
                      isInvest ? "text-emerald" : "text-crimson"
                    }`}
                  >
                    Final Verdict ({data.ticker})
                  </span>
                </div>
                
                {/* Watchlist Button */}
                <button
                  onClick={handleWatchlistToggle}
                  disabled={isWatchlistLoading}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all duration-300 border cursor-pointer hover:scale-105 active:scale-95 print:hidden ${
                    isWatchlisted
                      ? "bg-emerald/10 border-emerald/30 text-emerald"
                      : "bg-white/[0.02] border-border text-slate-400 hover:text-white"
                  }`}
                >
                  {isWatchlistLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isWatchlisted ? (
                    <>
                      <Check className="w-3 h-3" /> Watchlisted
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" /> Watchlist
                    </>
                  )}
                </button>
              </div>
              
              <h2
                className={`text-5xl md:text-6xl font-black tracking-tighter mb-3 ${
                  isInvest ? "text-emerald print:text-green-600" : "text-crimson print:text-red-600"
                }`}
              >
                {data.decision}
              </h2>
              <p className="text-slate-400 print:text-slate-700 leading-relaxed text-sm max-w-lg">
                {data.reasoning}
              </p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-5">
                {data.moatStrength && (
                  <span className="flex items-center text-[10px] bg-white/[0.03] border border-border px-2.5 py-1 rounded-md text-slate-400 font-medium print:border-slate-300 print:text-slate-700">
                    <Shield className="w-3 h-3 mr-1 text-emerald print:text-green-600" /> {data.moatStrength} Moat
                  </span>
                )}
                {data.riskLevel && (
                  <span className="flex items-center text-[10px] bg-white/[0.03] border border-border px-2.5 py-1 rounded-md text-slate-400 font-medium print:border-slate-300 print:text-slate-700">
                    <AlertTriangle className="w-3 h-3 mr-1 text-amber print:text-amber-600" /> {data.riskLevel} Risk
                  </span>
                )}
                {data.financialHealth && (
                  <span className="text-[10px] bg-white/[0.03] border border-border px-2.5 py-1 rounded-md text-slate-400 font-medium print:border-slate-300 print:text-slate-700">
                    Health: <span className="text-white print:text-black">{data.financialHealth}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Confidence Ring */}
            <div className="relative w-32 h-32 md:w-36 md:h-36 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="5"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke={isInvest ? "#10b981" : "#ef4444"}
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-mono font-bold text-white print:text-black">
                  {data.confidenceScore}
                </span>
                <span className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">
                  Confidence
                </span>
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* SVG Historical Price Chart */}
        {hasChartData && (
          <SpotlightCard
            spotlightColor="rgba(6, 182, 212, 0.05)"
            className="bg-surface/60 border border-border rounded-xl p-4 md:p-6 print:bg-white print:text-black print:border-slate-300"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 text-cyan mr-1.5" /> 90-Day Stock Price Trend
            </h3>
            <div className="relative w-full overflow-hidden">
              <svg
                className="w-full h-auto"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Definitions for Gradients */}
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line
                  x1={paddingX}
                  y1={paddingY}
                  x2={svgWidth - paddingX}
                  y2={paddingY}
                  stroke="rgba(255,255,255,0.03)"
                  strokeDasharray="2 4"
                />
                <line
                  x1={paddingX}
                  y1={paddingY + chartHeight / 2}
                  x2={svgWidth - paddingX}
                  y2={paddingY + chartHeight / 2}
                  stroke="rgba(255,255,255,0.03)"
                  strokeDasharray="2 4"
                />
                <line
                  x1={paddingX}
                  y1={paddingY + chartHeight}
                  x2={svgWidth - paddingX}
                  y2={paddingY + chartHeight}
                  stroke="rgba(255,255,255,0.05)"
                />

                {/* Area Path */}
                <path d={areaD} fill="url(#chartGradient)" />

                {/* Line Path */}
                <path
                  d={pathD}
                  stroke="url(#lineGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Tooltip Interaction Lines & Circles */}
                {hoverIndex !== null && points[hoverIndex] && (
                  <>
                    <line
                      x1={points[hoverIndex].x}
                      y1={paddingY}
                      x2={points[hoverIndex].x}
                      y2={paddingY + chartHeight}
                      stroke="rgba(6, 182, 212, 0.3)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={points[hoverIndex].x}
                      cy={points[hoverIndex].y}
                      r="5"
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </>
                )}

                {/* Axis Labels */}
                <text
                  x={paddingX - 10}
                  y={paddingY + 4}
                  fill="#475569"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  ${maxPrice.toFixed(0)}
                </text>
                <text
                  x={paddingX - 10}
                  y={paddingY + chartHeight / 2 + 3}
                  fill="#475569"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  ${((maxPrice + minPrice) / 2).toFixed(0)}
                </text>
                <text
                  x={paddingX - 10}
                  y={paddingY + chartHeight + 3}
                  fill="#475569"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  ${minPrice.toFixed(0)}
                </text>

                {/* Date Labels (First, Middle, Last) */}
                {points.length > 0 && (
                  <>
                    <text
                      x={points[0].x}
                      y={paddingY + chartHeight + 15}
                      fill="#475569"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="start"
                    >
                      {points[0].date}
                    </text>
                    <text
                      x={points[Math.floor(points.length / 2)].x}
                      y={paddingY + chartHeight + 15}
                      fill="#475569"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {points[Math.floor(points.length / 2)].date}
                    </text>
                    <text
                      x={points[points.length - 1].x}
                      y={paddingY + chartHeight + 15}
                      fill="#475569"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {points[points.length - 1].date}
                    </text>
                  </>
                )}

                {/* Invisible interactive bars for hover detection */}
                {points.map((p, index) => {
                  const barWidth = chartWidth / (points.length - 1 || 1);
                  return (
                    <rect
                      key={index}
                      x={p.x - barWidth / 2}
                      y={paddingY}
                      width={barWidth}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoverIndex(index)}
                      onMouseLeave={() => setHoverIndex(null)}
                    />
                  );
                })}
              </svg>
            </div>
            {hoverIndex !== null && points[hoverIndex] && (
              <div className="mt-2 text-center text-xs font-mono text-cyan">
                <span>{points[hoverIndex].date}: </span>
                <span className="font-bold text-white">${points[hoverIndex].price.toFixed(2)}</span>
              </div>
            )}
          </SpotlightCard>
        )}

        {/* Key Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {allMetrics.map((m) => (
            <SpotlightCard
              key={m.label}
              spotlightColor={m.isPrimary ? "rgba(16, 185, 129, 0.08)" : "rgba(6, 182, 212, 0.05)"}
              className={`border border-border p-3.5 rounded-xl transition-all duration-300 print:bg-white print:text-black print:border-slate-300 ${
                m.isPrimary ? "bg-surface/80" : "bg-surface/40"
              }`}
            >
              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                {m.label}
              </span>
              <p className={`font-mono font-bold text-white print:text-black ${
                m.isPrimary ? "text-lg" : "text-sm"
              }`}>
                {m.value || "N/A"}
              </p>
            </SpotlightCard>
          ))}
        </div>

        {/* Competitor Benchmarking Matrix */}
        {competitorRows.length > 0 && (
          <SpotlightCard
            spotlightColor="rgba(99, 102, 241, 0.05)"
            className="bg-surface/60 border border-border rounded-xl p-4 md:p-6 overflow-hidden print:bg-white print:text-black print:border-slate-300"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
              <Shield className="w-3.5 h-3.5 text-indigo-400 mr-1.5" /> Rival Competitor Benchmarking
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/50 text-[9px] text-slate-500 uppercase">
                    <th className="py-2">Company</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Market Cap</th>
                    <th className="py-2 text-right">P/E Ratio</th>
                    <th className="py-2 text-right">Profit Margin</th>
                    <th className="py-2 text-right">Rev Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-slate-300 print:text-black">
                  {/* Main Stock Row */}
                  <tr className="bg-white/[0.02] font-semibold text-white print:text-black">
                    <td className="py-2.5 font-bold">{data.ticker} (Researched)</td>
                    <td className="py-2.5 text-right">{data.keyMetrics?.currentPrice}</td>
                    <td className="py-2.5 text-right">{data.keyMetrics?.marketCap}</td>
                    <td className="py-2.5 text-right">{data.keyMetrics?.peRatio}</td>
                    <td className="py-2.5 text-right">{data.keyMetrics?.profitMargin}</td>
                    <td className="py-2.5 text-right">{data.keyMetrics?.revenueGrowth}</td>
                  </tr>
                  {/* Competitors Rows */}
                  {competitorRows.map((r: any) => (
                    <tr key={r.ticker} className="hover:bg-white/[0.01]">
                      <td className="py-2.5 text-slate-400 print:text-slate-800">
                        {r.ticker} ({r.name?.slice(0, 15)})
                      </td>
                      <td className="py-2.5 text-right">{r.price}</td>
                      <td className="py-2.5 text-right">{r.marketCap}</td>
                      <td className="py-2.5 text-right">{r.peRatio}</td>
                      <td className="py-2.5 text-right">{r.profitMargin}</td>
                      <td className="py-2.5 text-right">{r.revenueGrowth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SpotlightCard>
        )}

        {/* Bull & Bear Case Split */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SpotlightCard
            spotlightColor="rgba(16, 185, 129, 0.1)"
            className="bg-surface/60 border border-border rounded-xl overflow-hidden print:bg-white print:text-black print:border-slate-300"
          >
            <div className="bg-emerald/[0.03] px-4 py-2.5 border-b border-border flex items-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald mr-2" />
              <h3 className="font-bold text-emerald text-[10px] uppercase tracking-wider">Bull Case</h3>
            </div>
            <ul className="p-4 space-y-2.5">
              {(data.bullPoints || []).map((b: string, i: number) => (
                <li key={i} className="flex items-start">
                  <span className="w-4 h-4 rounded-md bg-emerald/8 text-emerald flex items-center justify-center mt-0.5 mr-2.5 flex-shrink-0 text-[10px]">
                    ✓
                  </span>
                  <span className="text-slate-400 print:text-slate-800 text-xs leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </SpotlightCard>

          <SpotlightCard
            spotlightColor="rgba(239, 68, 68, 0.1)"
            className="bg-surface/60 border border-border rounded-xl overflow-hidden print:bg-white print:text-black print:border-slate-300"
          >
            <div className="bg-crimson/[0.03] px-4 py-2.5 border-b border-border flex items-center">
              <TrendingDown className="w-3.5 h-3.5 text-crimson mr-2" />
              <h3 className="font-bold text-crimson text-[10px] uppercase tracking-wider">Bear Case</h3>
            </div>
            <ul className="p-4 space-y-2.5">
              {(data.bearPoints || []).map((b: string, i: number) => (
                <li key={i} className="flex items-start">
                  <span className="w-4 h-4 rounded-md bg-crimson/8 text-crimson flex items-center justify-center mt-0.5 mr-2.5 flex-shrink-0 text-[10px] font-bold">
                    ✕
                  </span>
                  <span className="text-slate-400 print:text-slate-800 text-xs leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </SpotlightCard>
        </div>

        {/* Devil's Advocate Critique report */}
        {data.critique && (
          <SpotlightCard
            spotlightColor="rgba(239, 68, 68, 0.05)"
            className="bg-surface/60 border border-border rounded-xl p-4 md:p-6 print:bg-white print:text-black print:border-slate-300"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-crimson mb-3 flex items-center font-mono">
              <Flame className="w-4 h-4 text-crimson mr-1.5" /> Devil's Advocate Critique (Blind Spots & Risks)
            </h3>
            <div className="space-y-3 font-sans text-xs text-slate-400 print:text-slate-800 leading-relaxed">
              {data.critique.split("\n").filter(Boolean).map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </SpotlightCard>
        )}
      </div>

      {/* Right Column: Sticky Chat Sidebar + Actions */}
      <div className="lg:col-span-4 xl:col-span-3 space-y-5 lg:sticky lg:top-[90px] self-start print:hidden">
        
        {/* Follow-up Interactive Chat */}
        {data.id && (
          <SpotlightCard
            spotlightColor="rgba(6, 182, 212, 0.05)"
            className="bg-surface/60 border border-border rounded-xl overflow-hidden flex flex-col h-[480px]"
          >
            <div className="bg-cyan/[0.03] px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center">
                <MessageSquare className="w-3.5 h-3.5 text-cyan mr-2" />
                <h3 className="font-bold text-cyan text-[10px] uppercase tracking-wider">
                  Ask follow-up questions
                </h3>
              </div>
              <span className="text-[8px] bg-cyan/10 text-cyan px-2 py-0.5 rounded font-mono font-bold">
                Groq Powered
              </span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <MessageSquare className="w-8 h-8 opacity-20 text-slate-400" />
                  <p className="text-center max-w-xs leading-normal">
                    Ask follow-up questions about the P/E ratio, valuation metrics, competitive position, or risks.
                  </p>
                </div>
              ) : (
                chatMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 leading-relaxed ${
                        m.role === "user"
                          ? "bg-gradient-to-r from-emerald/20 to-cyan/20 border border-cyan/20 text-white"
                          : "bg-white/[0.02] border border-border/50 text-slate-300"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content || "..."}</p>
                    </div>
                  </div>
                ))
              )}
              {isChatSending && chatMessages[chatMessages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.02] border border-border/50 rounded-xl px-3 py-2 text-slate-500 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-cyan" />
                    <span>Agent is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleChatSubmit}
              className="border-t border-border/50 p-2 bg-surface/80 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatSending}
                placeholder="e.g. Is the valuation justified?"
                className="flex-1 bg-white/[0.02] border border-border/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan/50 transition-colors placeholder:text-slate-600 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isChatSending || !chatInput.trim()}
                className="w-8 h-8 rounded-xl bg-cyan/10 hover:bg-cyan/20 border border-cyan/20 flex items-center justify-center text-cyan disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </SpotlightCard>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 pt-2">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center w-full px-5 py-3 font-semibold text-xs bg-white/[0.02] border border-border hover:bg-white/[0.06] text-slate-300 rounded-xl transition-all duration-300 cursor-pointer"
          >
            <Printer className="mr-2" size={14} />
            Print / Save PDF
          </button>

          <button
            onClick={onReset}
            className="group flex items-center justify-center w-full px-5 py-3 font-semibold text-xs bg-gradient-to-r from-emerald to-cyan text-white rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:shadow-[0_0_50px_rgba(16,185,129,0.25)] transition-all duration-300 cursor-pointer"
          >
            New Research
            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={14} />
          </button>
        </div>
      </div>

    </div>
  );
}
