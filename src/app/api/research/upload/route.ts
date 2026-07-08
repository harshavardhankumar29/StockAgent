import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage } from "@langchain/core/messages";

export const maxDuration = 120; // 2 minutes max for file analysis

// Instantiate Groq client
const groq = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0.1,
  maxTokens: 1024,
});

// Groq Vision model for image analysis
const groqVision = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.2-11b-vision-preview",
  temperature: 0.1,
  maxTokens: 1024,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    const fileType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parsedText = "";
    let extractedTicker = "";
    let extractedCompanyName = "";

    if (fileType === "application/pdf") {
      // 1. PDF Parsing
      try {
        const dynamicPdfParse = require("pdf-parse");
        const data = await dynamicPdfParse(buffer);
        parsedText = data.text || "";
      } catch (pdfErr: any) {
        console.error("❌ PDF parse error:", pdfErr);
        return NextResponse.json({ error: "Failed to parse PDF text: " + pdfErr.message }, { status: 400 });
      }

      if (!parsedText.trim()) {
        return NextResponse.json({ error: "Extracted PDF text is empty." }, { status: 400 });
      }

      // Ask LLM to extract ticker and company name from PDF text
      try {
        const prompt = `Analyze the following text extracted from a financial document. Identify the primary company name and its public stock ticker symbol. 
Return ONLY a valid JSON object in this format: {"ticker":"AAPL","companyName":"Apple Inc."}. If no ticker/company is found, return {"ticker":"","companyName":""}.
Text:
${parsedText.slice(0, 4000)}`;

        const response = await groq.invoke([new HumanMessage(prompt)]);
        const text = typeof response.content === "string" ? response.content.trim() : "";
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const parsed = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
          extractedTicker = parsed.ticker || "";
          extractedCompanyName = parsed.companyName || "";
        }
      } catch (llmErr) {
        console.error("❌ LLM extraction from PDF failed:", llmErr);
      }

    } else if (fileType.startsWith("image/")) {
      // 2. Image Parsing (Vision)
      try {
        const base64Image = buffer.toString("base64");
        const imageUrl = `data:${fileType};base64,${base64Image}`;

        const prompt = new HumanMessage({
          content: [
            { type: "text", text: `This is an uploaded stock chart, statement, or financial document. Identify:
1. The company name and its stock ticker symbol.
2. A detailed summary of what is shown (trends, breakout points, financials, or observations).

Return your findings in this exact JSON format:
{"ticker":"AAPL","companyName":"Apple Inc.","summary":"Detailed summary here..."}` },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        });

        const response = await groqVision.invoke([prompt]);
        const text = typeof response.content === "string" ? response.content.trim() : "";
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");

        if (jsonStart !== -1 && jsonEnd !== -1) {
          const parsed = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
          extractedTicker = parsed.ticker || "";
          extractedCompanyName = parsed.companyName || "";
          parsedText = parsed.summary || "Image analyzed.";
        }
      } catch (imgErr: any) {
        console.error("❌ Image vision parse error:", imgErr);
        return NextResponse.json({ error: "Failed to analyze image: " + imgErr.message }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Unsupported file type. Please upload a PDF or an Image." }, { status: 400 });
    }

    if (!extractedTicker) {
      return NextResponse.json({ error: "Could not identify stock ticker in document." }, { status: 400 });
    }

    // Save to UploadedContext table
    const uploadedContext = await prisma.uploadedContext.create({
      data: {
        userId,
        fileName,
        fileType: fileType === "application/pdf" ? "PDF" : "IMAGE",
        parsedText: fileType === "application/pdf" ? parsedText.slice(0, 10000) : parsedText, // cap PDF text length to avoid DB overload
      },
    });

    return NextResponse.json({
      ticker: extractedTicker.toUpperCase(),
      companyName: extractedCompanyName || extractedTicker,
      uploadedContextId: uploadedContext.id,
    });
  } catch (error: any) {
    console.error("❌ Upload API error:", error);
    return NextResponse.json({ error: "Upload processing failed: " + error.message }, { status: 500 });
  }
}
