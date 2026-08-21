-- CreateTable
CREATE TABLE "commitment_events" (
    "id" TEXT NOT NULL,
    "commitment_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "estimated_effort_hours" DECIMAL(5,2),
    "flexibility_override" "CommitmentFlexibility",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commitment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commitment_events_commitment_id_start_at_idx" ON "commitment_events"("commitment_id", "start_at");

-- AddForeignKey
ALTER TABLE "commitment_events" ADD CONSTRAINT "commitment_events_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
