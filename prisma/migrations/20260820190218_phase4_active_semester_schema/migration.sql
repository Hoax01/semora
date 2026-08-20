-- CreateEnum
CREATE TYPE "ActiveCourseSelectionStatus" AS ENUM ('ACTIVE', 'DROPPED');

-- AlterTable
ALTER TABLE "semester_workspaces" ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "locked_candidate_semester_id" TEXT;

-- CreateTable
CREATE TABLE "active_course_selections" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dropped_at" TIMESTAMP(3),
    "status" "ActiveCourseSelectionStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "active_course_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_course_states" (
    "id" TEXT NOT NULL,
    "active_course_selection_id" TEXT NOT NULL,
    "data_completeness" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "data_confidence" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_course_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "active_course_selections_workspace_id_status_idx" ON "active_course_selections"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "active_course_selections_workspace_id_section_id_status_idx" ON "active_course_selections"("workspace_id", "section_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "active_course_states_active_course_selection_id_key" ON "active_course_states"("active_course_selection_id");

-- AddForeignKey
ALTER TABLE "semester_workspaces" ADD CONSTRAINT "semester_workspaces_locked_candidate_semester_id_fkey" FOREIGN KEY ("locked_candidate_semester_id") REFERENCES "candidate_semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_course_selections" ADD CONSTRAINT "active_course_selections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "semester_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_course_selections" ADD CONSTRAINT "active_course_selections_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_course_states" ADD CONSTRAINT "active_course_states_active_course_selection_id_fkey" FOREIGN KEY ("active_course_selection_id") REFERENCES "active_course_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
