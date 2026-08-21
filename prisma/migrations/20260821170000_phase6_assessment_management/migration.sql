-- CreateEnum
CREATE TYPE "AssessmentWorkStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- AlterEnum
ALTER TYPE "AcademicSourceType" ADD VALUE 'USER_ENTERED';

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "progress_percentage" DECIMAL(5,2),
ADD COLUMN     "work_status" "AssessmentWorkStatus" NOT NULL DEFAULT 'NOT_STARTED';
