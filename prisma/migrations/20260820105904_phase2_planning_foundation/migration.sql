-- CreateEnum
CREATE TYPE "CommitmentCategory" AS ENUM ('TASHIP', 'SOCIETY', 'WORK', 'RESEARCH', 'GYM', 'COMMUTE', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CommitmentFlexibility" AS ENUM ('HARD', 'SOFT', 'FLEXIBLE');

-- CreateTable
CREATE TABLE "semester_preferences" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "workload_priority" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "schedule_priority" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "career_priority" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "interest_priority" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "grade_safety_priority" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "project_preference" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "exam_preference" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "continuous_assessment_preference" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "free_day_priority" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "early_class_aversion" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "late_class_aversion" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "max_preferred_hard_courses" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_semesters" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_course_selections" (
    "id" TEXT NOT NULL,
    "candidate_semester_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_course_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_course_preferences" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "course_offering_id" TEXT NOT NULL,
    "interest_score" DECIMAL(3,2),
    "career_relevance_score" DECIMAL(3,2),
    "manual_difficulty_estimate" DECIMAL(3,2),
    "manual_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_course_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CommitmentCategory" NOT NULL,
    "weekly_effort_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "flexibility" "CommitmentFlexibility" NOT NULL DEFAULT 'FLEXIBLE',
    "priority" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitment_meetings" (
    "id" TEXT NOT NULL,
    "commitment_id" TEXT NOT NULL,
    "day_of_week" "MeetingDay" NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,

    CONSTRAINT "commitment_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "semester_preferences_workspace_id_key" ON "semester_preferences"("workspace_id");

-- CreateIndex
CREATE INDEX "candidate_semesters_workspace_id_is_archived_idx" ON "candidate_semesters"("workspace_id", "is_archived");

-- CreateIndex
CREATE INDEX "candidate_course_selections_section_id_idx" ON "candidate_course_selections"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_course_selections_candidate_semester_id_section_i_key" ON "candidate_course_selections"("candidate_semester_id", "section_id");

-- CreateIndex
CREATE INDEX "user_course_preferences_course_offering_id_idx" ON "user_course_preferences"("course_offering_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_course_preferences_workspace_id_course_offering_id_key" ON "user_course_preferences"("workspace_id", "course_offering_id");

-- CreateIndex
CREATE INDEX "commitments_workspace_id_idx" ON "commitments"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "commitment_meetings_commitment_id_day_of_week_start_time_en_key" ON "commitment_meetings"("commitment_id", "day_of_week", "start_time", "end_time");

-- AddForeignKey
ALTER TABLE "semester_preferences" ADD CONSTRAINT "semester_preferences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "semester_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_semesters" ADD CONSTRAINT "candidate_semesters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "semester_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_course_selections" ADD CONSTRAINT "candidate_course_selections_candidate_semester_id_fkey" FOREIGN KEY ("candidate_semester_id") REFERENCES "candidate_semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_course_selections" ADD CONSTRAINT "candidate_course_selections_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_preferences" ADD CONSTRAINT "user_course_preferences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "semester_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_preferences" ADD CONSTRAINT "user_course_preferences_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "semester_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitment_meetings" ADD CONSTRAINT "commitment_meetings_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
