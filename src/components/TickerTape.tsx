import React from "react";

export default function TickerTape() {
  const stocks = [
    { ticker: 'AAPL', price: '189.84', change: '+1.24%', up: true },
    { ticker: 'NVDA', price: '875.28', change: '+3.15%', up: true },
    { ticker: 'TSLA', price: '175.21', change: '-0.89%', up: false },
    { ticker: 'MSFT', price: '415.56', change: '+0.67%', up: true },
    { ticker: 'AMZN', price: '178.25', change: '-1.12%', up: false },
    { ticker: 'META', price: '493.50', change: '+2.05%', up: true },
    { ticker: 'GOOG', price: '174.12', change: '+0.94%', up: true },
    { ticker: 'JPM', price: '198.45', change: '-0.34%', up: false },
  ];

  return (
    <div className="w-full bg-base/90 backdrop-blur-xl border-b border-border overflow-hidden py-1.5 select-none">
      <div className="flex animate-ticker whitespace-nowrap">
        {[...stocks, ...stocks, ...stocks].map((s, i) => (
          <div key={i} className="flex items-center mx-5 font-mono text-[10px]">
            <span className="text-slate-500 mr-1.5 font-semibold">{s.ticker}</span>
            <span className="text-slate-400 mr-1.5">${s.price}</span>
            <span className={`font-semibold ${s.up ? 'text-emerald' : 'text-crimson'}`}>{s.change}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
