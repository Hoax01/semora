-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('COURSE_OUTLINE', 'COURSE_MEMO', 'COURSE_TIMING', 'OTHER');

-- AlterTable
ALTER TABLE "active_course_states" ADD COLUMN "outline_document_id" TEXT;

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "course_offering_id" TEXT,
    "document_type" "DocumentType" NOT NULL DEFAULT 'COURSE_OUTLINE',
    "original_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_hash" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_user_id_uploaded_at_idx" ON "documents"("user_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "documents_workspace_id_course_offering_id_idx" ON "documents"("workspace_id", "course_offering_id");

-- CreateIndex
CREATE INDEX "documents_user_id_file_hash_idx" ON "documents"("user_id", "file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "active_course_states_outline_document_id_key" ON "active_course_states"("outline_document_id");

-- AddForeignKey
ALTER TABLE "active_course_states" ADD CONSTRAINT "active_course_states_outline_document_id_fkey" FOREIGN KEY ("outline_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "semester_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
