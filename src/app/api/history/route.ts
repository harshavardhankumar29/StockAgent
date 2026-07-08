import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    try {
      const record = await prisma.researchHistory.findUnique({
        where: { id },
      });
      if (!record || record.userId !== userId) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }
      return NextResponse.json(record);
    } catch (error) {
      console.error("❌ Failed to fetch research report by id:", error);
      return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
    }
  }

  try {
    const history = await prisma.researchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json(history);
  } catch (error) {
    console.error("❌ Failed to fetch research history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
