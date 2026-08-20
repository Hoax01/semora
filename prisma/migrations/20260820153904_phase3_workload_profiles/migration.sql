-- CreateEnum
CREATE TYPE "WorkloadProfileSource" AS ENUM ('STRUCTURAL_ESTIMATE', 'USER_ESTIMATE', 'VERIFIED_OUTLINE');

-- CreateTable
CREATE TABLE "course_workload_profiles" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "course_offering_id" TEXT NOT NULL,
    "section_id" TEXT,
    "overall_intensity" DECIMAL(3,1),
    "continuous_workload" DECIMAL(3,1),
    "assignment_intensity" DECIMAL(3,1),
    "quiz_intensity" DECIMAL(3,1),
    "project_intensity" DECIMAL(3,1),
    "exam_intensity" DECIMAL(3,1),
    "lab_intensity" DECIMAL(3,1),
    "reading_intensity" DECIMAL(3,1),
    "schedule_burden" DECIMAL(3,1),
    "assessment_fragmentation" DECIMAL(3,1),
    "estimated_weekly_hours" DECIMAL(5,2),
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.35,
    "source_type" "WorkloadProfileSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_workload_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_workload_profiles_course_offering_id_idx" ON "course_workload_profiles"("course_offering_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_workload_profiles_workspace_id_course_offering_id_key" ON "course_workload_profiles"("workspace_id", "course_offering_id");

-- AddForeignKey
ALTER TABLE "course_workload_profiles" ADD CONSTRAINT "course_workload_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "semester_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_workload_profiles" ADD CONSTRAINT "course_workload_profiles_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_workload_profiles" ADD CONSTRAINT "course_workload_profiles_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
