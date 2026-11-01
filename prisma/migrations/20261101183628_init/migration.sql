-- CreateEnum
CREATE TYPE "Split" AS ENUM ('TRAIN', 'EVAL');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('NEW', 'DRAFTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED_APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('CORRECT', 'INCOMPLETE', 'WRONG');

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "customerQuestion" TEXT NOT NULL,
    "expertResolution" TEXT NOT NULL,
    "productArea" TEXT NOT NULL,
    "split" "Split" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "heading" TEXT,
    "text" TEXT NOT NULL,
    "tsv" tsvector,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKeyEnv" TEXT NOT NULL DEFAULT 'LLM_API_KEY',
    "promptVersion" TEXT NOT NULL,
    "useExamples" BOOLEAN NOT NULL DEFAULT false,
    "maxExamples" INTEGER NOT NULL DEFAULT 3,
    "topK" INTEGER NOT NULL DEFAULT 4,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "agentConfigId" TEXT NOT NULL,
    "aiDraft" TEXT NOT NULL,
    "finalAnswer" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "sourceRefs" JSONB NOT NULL,
    "exampleRefs" JSONB NOT NULL,
    "editDistance" INTEGER,
    "reviewer" TEXT,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalSetCase" (
    "evalSetId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,

    CONSTRAINT "EvalSetCase_pkey" PRIMARY KEY ("evalSetId","caseId")
);

-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL,
    "evalSetId" TEXT NOT NULL,
    "agentConfigId" TEXT NOT NULL,
    "label" TEXT,
    "source" TEXT NOT NULL DEFAULT 'live',
    "examplePoolSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sourceRefs" JSONB NOT NULL,
    "exampleRefs" JSONB NOT NULL,
    "error" TEXT,
    "latencyMs" INTEGER,
    "rating" "Rating",
    "note" TEXT,
    "ratedBy" TEXT,
    "ratedAt" TIMESTAMP(3),

    CONSTRAINT "EvalResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Case_ticketId_key" ON "Case"("ticketId");

-- CreateIndex
CREATE INDEX "Case_split_status_idx" ON "Case"("split", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_filename_key" ON "Document"("filename");

-- CreateIndex
CREATE INDEX "Chunk_tsv_idx" ON "Chunk" USING GIN ("tsv");

-- CreateIndex
CREATE UNIQUE INDEX "Chunk_documentId_ordinal_key" ON "Chunk"("documentId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_key_key" ON "AgentConfig"("key");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_caseId_idx" ON "Review"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "EvalSet_name_key" ON "EvalSet"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EvalResult_runId_caseId_key" ON "EvalResult"("runId", "caseId");

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_agentConfigId_fkey" FOREIGN KEY ("agentConfigId") REFERENCES "AgentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalSetCase" ADD CONSTRAINT "EvalSetCase_evalSetId_fkey" FOREIGN KEY ("evalSetId") REFERENCES "EvalSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalSetCase" ADD CONSTRAINT "EvalSetCase_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalRun" ADD CONSTRAINT "EvalRun_evalSetId_fkey" FOREIGN KEY ("evalSetId") REFERENCES "EvalSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalRun" ADD CONSTRAINT "EvalRun_agentConfigId_fkey" FOREIGN KEY ("agentConfigId") REFERENCES "AgentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalResult" ADD CONSTRAINT "EvalResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalResult" ADD CONSTRAINT "EvalResult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
