-- CreateEnum
CREATE TYPE "ExtractionVerificationState" AS ENUM ('VERIFIED', 'VERIFIED_WITH_GAPS', 'REJECTED');

-- CreateTable
CREATE TABLE "extraction_verifications" (
    "id" TEXT NOT NULL,
    "extraction_job_id" TEXT NOT NULL,
    "verified_by_user_id" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_state" "ExtractionVerificationState" NOT NULL,

    CONSTRAINT "extraction_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extraction_verifications_extraction_job_id_key" ON "extraction_verifications"("extraction_job_id");

-- CreateIndex
CREATE INDEX "extraction_verifications_verified_by_user_id_verified_at_idx" ON "extraction_verifications"("verified_by_user_id", "verified_at");

-- AddForeignKey
ALTER TABLE "extraction_verifications" ADD CONSTRAINT "extraction_verifications_extraction_job_id_fkey" FOREIGN KEY ("extraction_job_id") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_verifications" ADD CONSTRAINT "extraction_verifications_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
