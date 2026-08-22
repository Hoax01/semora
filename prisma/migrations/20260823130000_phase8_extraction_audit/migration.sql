-- AlterTable
ALTER TABLE "extraction_drafts" ADD COLUMN "initial_payload" JSONB;

-- CreateTable
CREATE TABLE "extraction_corrections" (
    "id" TEXT NOT NULL,
    "extraction_job_id" TEXT NOT NULL,
    "corrected_by_user_id" TEXT NOT NULL,
    "field_path" TEXT NOT NULL,
    "original_value" TEXT NOT NULL,
    "corrected_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extraction_corrections_extraction_job_id_created_at_idx" ON "extraction_corrections"("extraction_job_id", "created_at");

-- CreateIndex
CREATE INDEX "extraction_corrections_corrected_by_user_id_created_at_idx" ON "extraction_corrections"("corrected_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "extraction_corrections_field_path_created_at_idx" ON "extraction_corrections"("field_path", "created_at");

-- AddForeignKey
ALTER TABLE "extraction_corrections" ADD CONSTRAINT "extraction_corrections_extraction_job_id_fkey" FOREIGN KEY ("extraction_job_id") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_corrections" ADD CONSTRAINT "extraction_corrections_corrected_by_user_id_fkey" FOREIGN KEY ("corrected_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;