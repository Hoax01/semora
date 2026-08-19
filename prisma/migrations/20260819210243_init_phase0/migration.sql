-- CreateEnum
CREATE TYPE "AcademicTermType" AS ENUM ('FALL', 'SPRING', 'SUMMER', 'OTHER');

-- CreateEnum
CREATE TYPE "AcademicTermStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GradingMode" AS ENUM ('ABSOLUTE', 'RELATIVE', 'PASS_FAIL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MeetingDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('LECTURE', 'LAB', 'TUTORIAL', 'SEMINAR', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkspaceState" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_terms" (
    "id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "term_type" "AcademicTermType" NOT NULL,
    "academic_year" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "add_drop_end_date" DATE,
    "exam_start_date" DATE,
    "exam_end_date" DATE,
    "status" "AcademicTermStatus" NOT NULL DEFAULT 'UPCOMING',

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "credit_hours_default" DECIMAL(4,1) NOT NULL,
    "department" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_offerings" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "academic_term_id" TEXT NOT NULL,
    "credit_hours" DECIMAL(4,1) NOT NULL,
    "description_override" TEXT,
    "grading_mode" "GradingMode" NOT NULL DEFAULT 'UNKNOWN',
    "source_confidence" TEXT NOT NULL DEFAULT 'OFFICIAL_IMPORT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "course_offering_id" TEXT NOT NULL,
    "section_code" TEXT NOT NULL,
    "capacity" INTEGER,
    "instructor_display" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "day_of_week" "MeetingDay" NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "meeting_type" "MeetingType" NOT NULL DEFAULT 'LECTURE',
    "location" TEXT,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester_workspaces" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "academic_term_id" TEXT NOT NULL,
    "state" "WorkspaceState" NOT NULL DEFAULT 'PLANNING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "universities_short_name_key" ON "universities"("short_name");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_university_id_name_key" ON "academic_terms"("university_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "courses_university_id_course_code_key" ON "courses"("university_id", "course_code");

-- CreateIndex
CREATE UNIQUE INDEX "course_offerings_course_id_academic_term_id_key" ON "course_offerings"("course_id", "academic_term_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_course_offering_id_section_code_key" ON "sections"("course_offering_id", "section_code");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_section_id_day_of_week_start_time_end_time_meeting_key" ON "meetings"("section_id", "day_of_week", "start_time", "end_time", "meeting_type");

-- CreateIndex
CREATE UNIQUE INDEX "semester_workspaces_user_id_academic_term_id_key" ON "semester_workspaces"("user_id", "academic_term_id");

-- AddForeignKey
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_workspaces" ADD CONSTRAINT "semester_workspaces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_workspaces" ADD CONSTRAINT "semester_workspaces_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
