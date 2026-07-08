import { tool } from "@langchain/core/tools";
import { z } from "zod";

// NewsAPI - 100 free requests/day
export const newsTool = tool(
  async ({ companyName }: { companyName: string }) => {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) {
        return JSON.stringify({
          error: "NEWS_API_KEY not configured",
          articles: [],
        });
      }

      const response = await fetch(
        `https://newsapi.org/v2/everything?` +
          `q=${encodeURIComponent(companyName)}&` +
          `sortBy=publishedAt&` +
          `language=en&` +
          `pageSize=10&` +
          `apiKey=${apiKey}`
      );

      const data = await response.json();

      if (data.articles) {
        const articles = data.articles.map(
          (article: {
            title: string;
            description: string;
            url: string;
            publishedAt: string;
            source: { name: string };
          }) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            publishedAt: article.publishedAt,
            source: article.source.name,
          })
        );
        return JSON.stringify(articles);
      }

      return JSON.stringify([]);
    } catch {
      return JSON.stringify([]);
    }
  },
  {
    name: "get_company_news",
    description: "Get recent news articles about a company",
    schema: z.object({
      companyName: z.string().describe("The company name to get news for"),
    }),
  }
);
