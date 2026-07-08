-- CreateTable
CREATE TABLE "ResearchHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "keyMetrics" TEXT NOT NULL,
    "bullPoints" TEXT NOT NULL,
    "bearPoints" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ResearchHistory_userId_idx" ON "ResearchHistory"("userId");
