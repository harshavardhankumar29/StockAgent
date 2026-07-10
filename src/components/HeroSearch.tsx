import React, { useState, useRef, useEffect } from "react";
import { Search, ArrowRight, Loader2, X } from "lucide-react";
import DecryptedText from "./reactbits/DecryptedText";
import ShinyText from "./reactbits/ShinyText";

interface HeroSearchProps {
  onResearch: (query: string, uploadedContextId?: string) => void;
}

interface Suggestion {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export default function HeroSearch({ onResearch }: HeroSearchProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const popularStocks = [
    { emoji: '🟢', name: 'NVIDIA', ticker: 'NVDA' },
    { emoji: '🍎', name: 'Apple', ticker: 'AAPL' },
    { emoji: '⚡', name: 'Tesla', ticker: 'TSLA' },
    { emoji: '📦', name: 'Amazon', ticker: 'AMZN' },
    { emoji: '🔍', name: 'Google', ticker: 'GOOG' },
    { emoji: '💜', name: 'Meta', ticker: 'META' },
  ];

  // Helper to add tickers to list
  const addTickers = (text: string) => {
    const parts = text
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);

    setSelectedTickers((prev) => {
      const next = [...prev];
      parts.forEach((p) => {
        if (!next.includes(p)) {
          next.push(p);
        }
      });
      return next;
    });
    setInputValue("");
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleRemoveTicker = (ticker: string) => {
    setSelectedTickers((prev) => prev.filter((t) => t !== ticker));
  };

  // Fetch suggestions with debouncing based on active segment
  useEffect(() => {
    const activeSegment = inputValue.trim();
    
    if (!activeSegment || activeSegment.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const res = await fetch(`/api/research/suggest?q=${encodeURIComponent(activeSegment)}`);
        if (res.ok) {
          const list = await res.json();
          setSuggestions(list);
          setShowDropdown(list.length > 0);
          setActiveSuggestionIdx(-1);
        }
      } catch (err) {
        console.warn("Failed to fetch autocomplete suggestions:", err);
      } finally {
        setIsSuggesting(false);
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(delayDebounce);
  }, [inputValue]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (item: Suggestion) => {
    addTickers(item.symbol);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let list = [...selectedTickers];
    if (inputValue.trim()) {
      const parts = inputValue.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
      parts.forEach(p => {
        if (!list.includes(p)) list.push(p);
      });
      setInputValue("");
    }

    if (list.length > 0) {
      setShowDropdown(false);
      onResearch(list.join(","));
    }
  };

  // Keyboard navigation inside dropdown + Backspace to delete tags
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !inputValue) {
      e.preventDefault();
      setSelectedTickers((prev) => prev.slice(0, -1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (showDropdown && activeSuggestionIdx >= 0 && activeSuggestionIdx < suggestions.length) {
        handleSelectSuggestion(suggestions[activeSuggestionIdx]);
      } else if (inputValue.trim()) {
        addTickers(inputValue);
      } else if (selectedTickers.length > 0) {
        onResearch(selectedTickers.join(","));
      }
      return;
    }

    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIdx((prev) => (prev + 1 >= suggestions.length ? 0 : prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIdx((prev) => (prev - 1 < 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handlePopularStockClick = (ticker: string) => {
    setSelectedTickers((prev) => {
      if (prev.includes(ticker)) return prev;
      return [...prev, ticker];
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.endsWith(",")) {
      addTickers(val.slice(0, -1));
    } else {
      setInputValue(val);
    }
  };

  return (
    <div className="flex flex-col items-center text-center space-y-8 p-6 rounded-3xl w-full max-w-2xl">
      {/* Headline */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald/5 border border-emerald/10 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-emerald font-semibold font-mono">
            Advanced Batch Research
          </span>
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
          Analyze single stocks or add multiple companies to perform a comprehensive batch research.
        </p>
      </div>

      {/* Search Bar & AutoComplete dropdown Container */}
      <div className="w-full max-w-xl relative" ref={containerRef}>
        <form onSubmit={handleSubmit} className="w-full group">
          <div className={`relative p-[1px] rounded-2xl transition-all duration-500 ${
            isFocused 
              ? 'bg-gradient-to-r from-emerald/50 via-cyan/50 to-indigo/50 shadow-[0_0_40px_rgba(16,185,129,0.12)]' 
              : 'bg-border'
          }`}>
            <div className="flex items-center bg-surface rounded-2xl px-5 py-3.5 flex-wrap gap-2">
              <Search className={`mr-1 transition-colors duration-300 ${isFocused ? 'text-emerald' : 'text-slate-600'} shrink-0`} size={18} />
              
              {/* Selected tags */}
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedTickers.map((ticker) => (
                  <span 
                    key={ticker} 
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald/10 border border-emerald/20 text-emerald text-xs font-mono font-bold animate-fade-in shrink-0"
                  >
                    {ticker}
                    <button
                      type="button"
                      onClick={() => handleRemoveTicker(ticker)}
                      className="hover:bg-emerald/20 rounded p-0.5 transition-colors cursor-pointer text-[9px] flex items-center justify-center w-3 h-3 text-emerald/70 hover:text-emerald"
                    >
                      <X size={8} />
                    </button>
                  </span>
                ))}
              </div>

              <input
                type="text"
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => {
                  setIsFocused(true);
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder={selectedTickers.length === 0 ? "Enter company name or ticker..." : "Add more..."}
                className="bg-transparent outline-none flex-1 text-white placeholder:text-slate-600 text-sm font-medium min-w-[120px]"
              />
              
              {/* Suggestion loading spinner inside input */}
              {isSuggesting && (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500 mr-2 shrink-0" />
              )}

              {/* Add Item Button */}
              {inputValue.trim() && (
                <button
                  type="button"
                  onClick={() => addTickers(inputValue)}
                  className="px-3 py-1.5 rounded-xl bg-cyan/10 hover:bg-cyan/20 border border-cyan/20 text-cyan text-xs font-semibold transition-all duration-200 cursor-pointer mr-2 shrink-0"
                >
                  + Add
                </button>
              )}

              {(selectedTickers.length > 0 || inputValue.trim()) && (
                <button 
                  type="submit"
                  title="Start Research"
                  className="p-2 rounded-xl bg-emerald/10 hover:bg-emerald/20 text-emerald transition-all duration-200 cursor-pointer shrink-0 animate-fade-in"
                >
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Floating Suggestion Dropdown List */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-[105%] left-0 w-full bg-surface/95 backdrop-blur-md border border-border rounded-xl shadow-2xl overflow-hidden z-50 py-1 text-left">
            {suggestions.map((item, idx) => (
              <button
                key={item.symbol + idx}
                onClick={() => handleSelectSuggestion(item)}
                onMouseEnter={() => setActiveSuggestionIdx(idx)}
                className={`w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.04] transition-colors text-left cursor-pointer border-l-2 ${
                  activeSuggestionIdx === idx 
                    ? "bg-white/[0.04] border-emerald text-white" 
                    : "border-transparent text-slate-300"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-white text-sm">{item.symbol}</span>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-semibold uppercase">
                      {item.type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 truncate block max-w-[320px]">{item.name}</span>
                </div>
                <span className="text-[10px] text-slate-600 font-mono font-semibold shrink-0 uppercase">
                  {item.exchange}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Popular Chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {popularStocks.map((s) => (
          <button
            key={s.ticker}
            onClick={() => handlePopularStockClick(s.ticker)}
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
