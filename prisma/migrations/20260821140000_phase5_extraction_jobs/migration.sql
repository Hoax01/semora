-- CreateEnum
CREATE TYPE "ExtractionJobStatus" AS ENUM ('PENDING', 'PARSING', 'EXTRACTING', 'REVIEW_REQUIRED', 'VERIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "extraction_jobs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "status" "ExtractionJobStatus" NOT NULL DEFAULT 'PENDING',
    "model_identifier" TEXT,
    "extractor_version" TEXT,
    "schema_version" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_drafts" (
    "id" TEXT NOT NULL,
    "extraction_job_id" TEXT NOT NULL,
    "draft_payload" JSONB NOT NULL,
    "overall_confidence" DECIMAL(3,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extraction_jobs_document_id_created_at_idx" ON "extraction_jobs"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "extraction_jobs_status_created_at_idx" ON "extraction_jobs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_drafts_extraction_job_id_key" ON "extraction_drafts"("extraction_job_id");

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_drafts" ADD CONSTRAINT "extraction_drafts_extraction_job_id_fkey" FOREIGN KEY ("extraction_job_id") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
