-- CreateEnum
CREATE TYPE "AcademicSourceType" AS ENUM ('VERIFIED_OUTLINE');

-- CreateEnum
CREATE TYPE "GradeAggregationRule" AS ENUM ('EQUAL_MEAN', 'POINTS_WEIGHTED_MEAN', 'EXPLICIT_WEIGHTS', 'BEST_N', 'DROP_LOWEST_N');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('ASSIGNMENT', 'QUIZ', 'PROJECT', 'PRESENTATION', 'MIDTERM', 'FINAL', 'PARTICIPATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentDatePrecision" AS ENUM ('EXACT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('UPCOMING', 'SUBMITTED', 'GRADED', 'MISSING', 'EXCUSED', 'DROPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "grading_schemes" (
    "id" TEXT NOT NULL,
    "active_course_state_id" TEXT NOT NULL,
    "grading_mode" "GradingMode" NOT NULL,
    "total_expected_weight" DECIMAL(6,3),
    "rounding_policy" TEXT,
    "source_type" "AcademicSourceType" NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grading_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_categories" (
    "id" TEXT NOT NULL,
    "grading_scheme_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight_percentage" DECIMAL(6,3),
    "aggregation_rule" "GradeAggregationRule" NOT NULL DEFAULT 'EXPLICIT_WEIGHTS',
    "rule_parameter_n" INTEGER,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "grade_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_thresholds" (
    "id" TEXT NOT NULL,
    "grading_scheme_id" TEXT NOT NULL,
    "letter_grade" TEXT NOT NULL,
    "minimum_percentage" DECIMAL(6,3) NOT NULL,
    "inclusive" BOOLEAN NOT NULL DEFAULT true,
    "source_type" "AcademicSourceType" NOT NULL,
    "source_document_id" TEXT NOT NULL,

    CONSTRAINT "grade_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "active_course_state_id" TEXT NOT NULL,
    "grade_category_id" TEXT,
    "title" TEXT NOT NULL,
    "assessment_type" "AssessmentType" NOT NULL,
    "weight_percentage" DECIMAL(6,3),
    "points_possible" DECIMAL(8,3),
    "due_at" DATE,
    "date_precision" "AssessmentDatePrecision" NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'UPCOMING',
    "estimated_effort_hours" DECIMAL(5,2),
    "effort_confidence" DECIMAL(3,2),
    "is_group_assessment" BOOLEAN NOT NULL DEFAULT false,
    "source_type" "AcademicSourceType" NOT NULL,
    "source_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workload_signals" (
    "id" TEXT NOT NULL,
    "active_course_state_id" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "value" DECIMAL(8,3),
    "source_document_id" TEXT NOT NULL,
    "confidence" DECIMAL(3,2),
    "source_type" "AcademicSourceType" NOT NULL,

    CONSTRAINT "workload_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grading_schemes_active_course_state_id_key" ON "grading_schemes"("active_course_state_id");
CREATE INDEX "grade_categories_grading_scheme_id_display_order_idx" ON "grade_categories"("grading_scheme_id", "display_order");
CREATE INDEX "grade_thresholds_grading_scheme_id_minimum_percentage_idx" ON "grade_thresholds"("grading_scheme_id", "minimum_percentage");
CREATE INDEX "assessments_active_course_state_id_due_at_idx" ON "assessments"("active_course_state_id", "due_at");
CREATE INDEX "assessments_grade_category_id_idx" ON "assessments"("grade_category_id");
CREATE UNIQUE INDEX "workload_signals_active_course_state_id_signal_type_key" ON "workload_signals"("active_course_state_id", "signal_type");

-- AddForeignKey
ALTER TABLE "grading_schemes" ADD CONSTRAINT "grading_schemes_active_course_state_id_fkey" FOREIGN KEY ("active_course_state_id") REFERENCES "active_course_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grading_schemes" ADD CONSTRAINT "grading_schemes_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grade_categories" ADD CONSTRAINT "grade_categories_grading_scheme_id_fkey" FOREIGN KEY ("grading_scheme_id") REFERENCES "grading_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grade_thresholds" ADD CONSTRAINT "grade_thresholds_grading_scheme_id_fkey" FOREIGN KEY ("grading_scheme_id") REFERENCES "grading_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grade_thresholds" ADD CONSTRAINT "grade_thresholds_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_active_course_state_id_fkey" FOREIGN KEY ("active_course_state_id") REFERENCES "active_course_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_grade_category_id_fkey" FOREIGN KEY ("grade_category_id") REFERENCES "grade_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workload_signals" ADD CONSTRAINT "workload_signals_active_course_state_id_fkey" FOREIGN KEY ("active_course_state_id") REFERENCES "active_course_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workload_signals" ADD CONSTRAINT "workload_signals_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
