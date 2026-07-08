import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Using Tavily - 1000 free searches/month
export const tavilySearchTool = tool(
  async ({ query }: { query: string }) => {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
        }),
      });

      const data = await response.json();

      if (data.results) {
        return JSON.stringify({
          answer: data.answer,
          results: data.results.map((r: Record<string, string>) => ({
            title: r.title,
            content: r.content,
            url: r.url,
          })),
        });
      }

      return "No results found";
    } catch (error) {
      // Fallback to DuckDuckGo if Tavily fails (completely free)
      console.error("Tavily search failed, falling back to DuckDuckGo:", error);
      return await duckDuckGoSearch(query);
    }
  },
  {
    name: "web_search",
    description:
      "Search the web for information about a company, its financials, news, and competitive landscape",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

// DuckDuckGo fallback - completely free, no API key needed
async function duckDuckGoSearch(query: string): Promise<string> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await response.json();

    const results: string[] = [];
    if (data.AbstractText) results.push(data.AbstractText);
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, 3).forEach(
        (topic: { Text?: string }) => {
          if (topic.Text) results.push(topic.Text);
        }
      );
    }

    return results.join("\n\n") || "No results found";
  } catch {
    return "Search unavailable";
  }
}
