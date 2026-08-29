-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "rate_limits_expiresAt_idx" ON "rate_limits"("expiresAt");
