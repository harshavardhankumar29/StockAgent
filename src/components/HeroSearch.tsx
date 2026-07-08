import React, { useState, useRef } from "react";
import { Search, ArrowRight, Paperclip, Loader2, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import DecryptedText from "./reactbits/DecryptedText";
import ShinyText from "./reactbits/ShinyText";

interface HeroSearchProps {
  onResearch: (query: string, uploadedContextId?: string) => void;
}

export default function HeroSearch({ onResearch }: HeroSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // File Upload Logic
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/research/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setUploadSuccess(`Identified: ${data.ticker}`);
      
      // Auto-trigger research for the extracted ticker with the linked context ID!
      setTimeout(() => {
        onResearch(data.ticker, data.uploadedContextId);
      }, 1200);

    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Failed to analyze document.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={`flex flex-col items-center text-center space-y-8 p-6 rounded-3xl transition-all duration-300 w-full max-w-2xl ${
        isDragging ? 'bg-cyan/5 border-2 border-dashed border-cyan/40 scale-102' : 'border-2 border-transparent'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,image/*"
        className="hidden"
      />

      {/* Headline */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald/5 border border-emerald/10 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-emerald font-semibold font-mono">
            Advanced Batch & Document Research
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
          Analyze single stocks, enter a comma-separated list for batch research, or upload a chart image/financial PDF context.
        </p>
      </div>

      {/* Search Bar Container */}
      <div className="w-full max-w-xl">
        <form onSubmit={handleSubmit} className="w-full group">
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
                placeholder="AAPL or AAPL, MSFT, TSLA or drag & drop files..."
                className="bg-transparent outline-none w-full text-white placeholder:text-slate-600 text-sm font-medium"
              />
              
              {/* Paperclip upload button */}
              <button
                type="button"
                onClick={handlePaperclipClick}
                disabled={isUploading}
                title="Upload PDF document or stock chart image"
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer mr-2 disabled:opacity-40"
              >
                <Paperclip size={16} />
              </button>

              {query.trim() && (
                <button 
                  type="submit"
                  className="p-2 rounded-xl bg-emerald/10 hover:bg-emerald/20 text-emerald transition-all duration-200 cursor-pointer"
                >
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Upload Status Feedbacks */}
        {isUploading && (
          <div className="mt-3 flex items-center justify-center gap-2 text-cyan font-mono text-[10px] uppercase tracking-wider animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Parsing file & extracting ticker symbol...</span>
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-emerald font-mono text-[10px] uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{uploadSuccess}. Starting RAG-grounded research...</span>
          </div>
        )}

        {uploadError && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-crimson font-mono text-[10px] uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Popular Chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {popularStocks.map((s) => (
          <button
            key={s.ticker}
            onClick={() => onResearch(s.ticker)}
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
