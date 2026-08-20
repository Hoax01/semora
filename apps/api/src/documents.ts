import { createHash } from 'node:crypto';
import express from 'express';
import {
  DEFAULT_MAX_DOCUMENT_BYTES,
  detectDocumentFormat,
  EXTRACTION_PARSER_VERSION,
  EXTRACTION_SCHEMA_VERSION,
  type DocumentFormat,
} from '@semora/extraction';
import { prisma } from './db.js';
import { removePrivateDocument, storePrivateDocument } from './document-storage.js';
import { requireUserId } from './session.js';

const supportedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

const extensionByFormat: Record<DocumentFormat, string> = {
  PDF: 'pdf',
  DOCX: 'docx',
  PLAIN_TEXT: 'txt',
};

function normalizedMimeType(value: string | undefined) {
  return value?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function fileExtension(fileName: string) {
  return fileName.toLowerCase().split('.').pop() ?? '';
}

function serializeDocument(document: {
  id: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  uploadedAt: Date;
}) {
  return {
    id: document.id,
    documentType: document.documentType,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    fileHash: document.fileHash,
    uploadedAt: document.uploadedAt.toISOString(),
  };
}

function serializeExtractionJob(job: {
  id: string;
  status: string;
  modelIdentifier: string | null;
  extractorVersion: string | null;
  schemaVersion: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failureReason: string | null;
}) {
  return {
    id: job.id,
    status: job.status,
    modelIdentifier: job.modelIdentifier,
    extractorVersion: job.extractorVersion,
    schemaVersion: job.schemaVersion,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    failureReason: job.failureReason,
  };
}

export function registerDocumentRoutes(app: express.Application) {
  app.post(
    '/api/active-selections/:selectionId/outline',
    express.raw({ type: [...supportedMimeTypes], limit: DEFAULT_MAX_DOCUMENT_BYTES }),
    async (request, response) => {
      const userId = await requireUserId(request, response);
      if (!userId || !prisma) return;

      const fileName = request.header('x-file-name')?.trim();
      if (!fileName) {
        response.status(400).json({ error: 'FILENAME_REQUIRED' });
        return;
      }

      const mimeType = normalizedMimeType(request.header('content-type'));
      if (!supportedMimeTypes.includes(mimeType as (typeof supportedMimeTypes)[number])) {
        response.status(415).json({ error: 'UNSUPPORTED_DOCUMENT_TYPE' });
        return;
      }

      let format: DocumentFormat;
      try {
        format = detectDocumentFormat({ fileName, mimeType });
      } catch {
        response.status(415).json({ error: 'UNSUPPORTED_DOCUMENT_TYPE' });
        return;
      }
      if (fileExtension(fileName) !== extensionByFormat[format]) {
        response.status(400).json({ error: 'FILENAME_EXTENSION_MISMATCH' });
        return;
      }

      if (!Buffer.isBuffer(request.body) || request.body.byteLength === 0) {
        response.status(400).json({ error: 'EMPTY_DOCUMENT' });
        return;
      }
      if (request.body.byteLength > DEFAULT_MAX_DOCUMENT_BYTES) {
        response.status(413).json({ error: 'DOCUMENT_TOO_LARGE' });
        return;
      }

      const activeSelection = await prisma.activeCourseSelection.findFirst({
        where: {
          id: request.params.selectionId,
          status: 'ACTIVE',
          workspace: { userId },
        },
        select: {
          id: true,
          workspaceId: true,
          state: { select: { id: true } },
          section: { select: { courseOfferingId: true } },
        },
      });
      if (!activeSelection) {
        response.status(404).json({ error: 'ACTIVE_SELECTION_NOT_FOUND' });
        return;
      }
      if (!activeSelection.state) {
        response.status(409).json({ error: 'ACTIVE_COURSE_STATE_NOT_FOUND' });
        return;
      }
      const activeCourseStateId = activeSelection.state.id;

      const data = new Uint8Array(request.body);
      const fileHash = createHash('sha256').update(data).digest('hex');
      const stored = await storePrivateDocument({
        ownerId: userId,
        originalFilename: fileName,
        data,
      });

      try {
        const document = await prisma.$transaction(async (transaction) => {
          const created = await transaction.document.create({
            data: {
              userId,
              workspaceId: activeSelection.workspaceId,
              courseOfferingId: activeSelection.section.courseOfferingId,
              originalFilename: stored.originalFilename,
              storageKey: stored.storageKey,
              mimeType,
              fileSize: data.byteLength,
              fileHash,
            },
          });
          const job = await transaction.extractionJob.create({
            data: {
              documentId: created.id,
              modelIdentifier: null,
              extractorVersion: EXTRACTION_PARSER_VERSION,
              schemaVersion: EXTRACTION_SCHEMA_VERSION,
            },
          });
          await transaction.activeCourseState.update({
            where: { id: activeCourseStateId },
            data: { outlineDocumentId: created.id },
          });
          return { created, job };
        });

        response.status(201).json({
          document: serializeDocument(document.created),
          extractionJob: serializeExtractionJob(document.job),
        });
      } catch (error) {
        await removePrivateDocument(stored.storageKey).catch(() => undefined);
        throw error;
      }
    },
  );
}
