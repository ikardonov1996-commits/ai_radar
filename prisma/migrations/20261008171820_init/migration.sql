-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "Price" AS ENUM ('free', 'freemium', 'paid');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('right', 'left');

-- CreateEnum
CREATE TYPE "SetStatus" AS ENUM ('want', 'using');

-- CreateEnum
CREATE TYPE "WillTry" AS ENUM ('yes', 'maybe', 'no');

-- CreateEnum
CREATE TYPE "TxKind" AS ENUM ('welcome', 'survey');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "interests" TEXT[],
    "anonId" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "developer" TEXT,
    "oneLiner" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconUrl" TEXT,
    "imageUrl" TEXT,
    "screenshots" TEXT[],
    "platforms" "Platform"[],
    "price" "Price" NOT NULL DEFAULT 'free',
    "rating" DOUBLE PRECISION,
    "installs" TEXT,
    "storeUrls" JSONB NOT NULL DEFAULT '{}',
    "topics" TEXT[],
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "altSourceIds" TEXT[],
    "manualEdit" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "dwellMs" INTEGER NOT NULL DEFAULT 0,
    "undone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Swipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT,
    "appId" TEXT NOT NULL,
    "status" "SetStatus" NOT NULL DEFAULT 'want',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "usefulness" INTEGER NOT NULL,
    "willTry" "WillTry" NOT NULL,
    "reasons" TEXT[],
    "comment" TEXT,
    "durationMs" INTEGER NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTx" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" "TxKind" NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "surveyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TokenTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_anonId_idx" ON "User"("anonId");

-- CreateIndex
CREATE INDEX "User_ipHash_idx" ON "User"("ipHash");

-- CreateIndex
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");

-- CreateIndex
CREATE INDEX "App_published_idx" ON "App"("published");

-- CreateIndex
CREATE UNIQUE INDEX "App_source_sourceId_key" ON "App"("source", "sourceId");

-- CreateIndex
CREATE INDEX "Swipe_userId_undone_idx" ON "Swipe"("userId", "undone");

-- CreateIndex
CREATE INDEX "Swipe_anonId_undone_idx" ON "Swipe"("anonId", "undone");

-- CreateIndex
CREATE INDEX "Swipe_createdAt_idx" ON "Swipe"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SetItem_userId_appId_key" ON "SetItem"("userId", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "SetItem_anonId_appId_key" ON "SetItem"("anonId", "appId");

-- CreateIndex
CREATE INDEX "Survey_createdAt_idx" ON "Survey"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_userId_appId_key" ON "Survey"("userId", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenTx_surveyId_key" ON "TokenTx"("surveyId");

-- CreateIndex
CREATE INDEX "TokenTx_userId_status_idx" ON "TokenTx"("userId", "status");

-- CreateIndex
CREATE INDEX "TokenTx_status_createdAt_idx" ON "TokenTx"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Event_type_createdAt_idx" ON "Event"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Event_anonId_idx" ON "Event"("anonId");

-- CreateIndex
CREATE INDEX "EmailCode_email_createdAt_idx" ON "EmailCode"("email", "createdAt");

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetItem" ADD CONSTRAINT "SetItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetItem" ADD CONSTRAINT "SetItem_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTx" ADD CONSTRAINT "TokenTx_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTx" ADD CONSTRAINT "TokenTx_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
