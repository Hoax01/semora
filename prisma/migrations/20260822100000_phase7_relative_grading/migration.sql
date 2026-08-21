-- CreateTable
CREATE TABLE "class_statistics" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "mean" DECIMAL(6,3) NOT NULL,
    "median" DECIMAL(6,3),
    "standard_deviation" DECIMAL(6,3),
    "minimum" DECIMAL(6,3),
    "maximum" DECIMAL(6,3),
    "source_type" "AcademicSourceType" NOT NULL DEFAULT 'USER_ENTERED',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_statistics_assessment_id_key" ON "class_statistics"("assessment_id");

-- AddForeignKey
ALTER TABLE "class_statistics" ADD CONSTRAINT "class_statistics_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;