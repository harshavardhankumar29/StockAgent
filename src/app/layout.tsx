import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockAgent - AI Investment Research",
  description:
    "Free AI-powered investment research agent. Get instant analysis on any company with financial data, news sentiment, competitive analysis, and risk assessment.",
  keywords: [
    "investment research",
    "AI stock analysis",
    "stock market",
    "financial analysis",
    "investment agent",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
