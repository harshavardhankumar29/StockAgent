import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import prisma from "@/lib/db";

export const maxDuration = 60; // 1 minute max

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { historyId, message, chatHistory } = await request.json();

    if (!historyId || !message) {
      return new Response(JSON.stringify({ error: "Report ID and message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load original research report from SQLite
    const record = await prisma.researchHistory.findUnique({
      where: { id: historyId },
    });

    if (!record || record.userId !== userId) {
      return new Response(JSON.stringify({ error: "Research report not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse reports details for prompt context
    const keyMetrics = JSON.parse(record.keyMetrics || "{}");
    const bullPoints = JSON.parse(record.bullPoints || "[]");
    const bearPoints = JSON.parse(record.bearPoints || "[]");

    const systemPrompt = `You are StockAgent.AI, an expert investment assistant. You just compiled a detailed research report on ${record.companyName} (${record.ticker}).
Here is the research dossier for reference:

VERDICT: ${record.decision} (Confidence Score: ${record.confidenceScore}%)
REASONING: ${record.reasoning}

KEY METRICS:
${Object.entries(keyMetrics).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

BULL POINTS:
${bullPoints.map((b: string) => `- ${b}`).join("\n")}

BEAR POINTS:
${bearPoints.map((b: string) => `- ${b}`).join("\n")}

DEVIL'S ADVOCATE CRITIQUE:
${record.critique || "N/A"}

Answer the user's follow-up questions about this company, its financials, risks, and outlook. Be concise, highly professional, and base your answers on the provided dossier. Keep answers under 120 words. If the question asks for information not in the dossier, use your financial knowledge but state that it is general information outside the original report scope.`;

    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      maxTokens: 500,
    });

    // Construct conversation history
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt)];
    
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: { role: string; content: string }) => {
        if (msg.role === "user") {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === "assistant") {
          messages.push(new AIMessage(msg.content));
        }
      });
    }

    // Add current user message
    messages.push(new HumanMessage(message));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const responseStream = await llm.stream(messages);
          for await (const chunk of responseStream) {
            if (chunk.content) {
              controller.enqueue(encoder.encode(String(chunk.content)));
            }
          }
          controller.close();
        } catch (error) {
          console.error("❌ Groq chat streaming failed:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("❌ Research follow-up chat route failed:", error);
    return new Response(JSON.stringify({ error: "Failed to generate chat response" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
