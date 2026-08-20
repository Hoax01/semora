import { readFile } from 'node:fs/promises';
import type express from 'express';
import {
  ExtractionParseError,
  courseDocumentExtractionSchema,
  parseDocument,
  type AcademicExtractionProvider,
} from '@semora/extraction';
import { prisma } from './db.js';
import { privateDocumentPath } from './document-storage.js';
import { requireUserId } from './session.js';

const UNCONFIGURED_PROVIDER = 'unconfigured';

class ExtractionProviderNotConfiguredError extends Error {
  constructor() {
    super('No course-outline extraction provider is configured.');
    this.name = 'ExtractionProviderNotConfiguredError';
  }
}

const unconfiguredProvider: AcademicExtractionProvider = {
  modelIdentifier: UNCONFIGURED_PROVIDER,
  async extractCourseDocument() {
    throw new ExtractionProviderNotConfiguredError();
  },
};

type ExtractionJobRecord = {
  id: string;
  status: string;
  modelIdentifier: string | null;
  extractorVersion: string | null;
  schemaVersion: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failureReason: string | null;
  document: {
    id: string;
    originalFilename: string;
    storageKey: string;
    mimeType: string;
    userId: string;
    courseOffering: {
      course: { courseCode: string; title: string };
    } | null;
  };
  draft: {
    id: string;
    draftPayload: unknown;
    overallConfidence: { toString(): string };
    createdAt: Date;
  } | null;
};

const extractionJobInclude = {
  document: {
    include: { courseOffering: { include: { course: true } } },
  },
  draft: true,
} as const;

function serializeExtractionJob(job: ExtractionJobRecord) {
  return {
    id: job.id,
    status: job.status,
    modelIdentifier: job.modelIdentifier,
    extractorVersion: job.extractorVersion,
    schemaVersion: job.schemaVersion,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    failureReason: job.failureReason,
    document: {
      id: job.document.id,
      originalFilename: job.document.originalFilename,
      mimeType: job.document.mimeType,
    },
    draft: job.draft
      ? {
          id: job.draft.id,
          payload: job.draft.draftPayload,
          overallConfidence: Number(job.draft.overallConfidence),
          createdAt: job.draft.createdAt.toISOString(),
        }
      : null,
  };
}

async function ownedJob(jobId: string, userId: string) {
  return prisma?.extractionJob.findFirst({
    where: { id: jobId, document: { userId, deletedAt: null } },
    include: extractionJobInclude,
  }) as Promise<ExtractionJobRecord | null> | undefined;
}

export async function processExtractionJob(
  jobId: string,
  userId: string,
  provider: AcademicExtractionProvider = unconfiguredProvider,
) {
  if (!prisma) return null;
  const job = await ownedJob(jobId, userId);
  if (!job) return null;
  if (job.status === 'REVIEW_REQUIRED' || job.status === 'VERIFIED') return job;

  const startedAt = new Date();
  await prisma.extractionJob.update({
    where: { id: job.id },
    data: {
      status: 'PARSING',
      startedAt,
      completedAt: null,
      failureReason: null,
    },
  });

  try {
    const data = await readFile(privateDocumentPath(job.document.storageKey));
    const normalized = await parseDocument({
      fileName: job.document.originalFilename,
      mimeType: job.document.mimeType,
      data,
    });

    await prisma.extractionJob.update({
      where: { id: job.id },
      data: { status: 'EXTRACTING' },
    });

    const extraction = await provider.extractCourseDocument(normalized, {
      documentId: job.document.id,
      ...(job.document.courseOffering?.course.courseCode
        ? { courseCode: job.document.courseOffering.course.courseCode }
        : {}),
      ...(job.document.courseOffering?.course.title
        ? { courseTitle: job.document.courseOffering.course.title }
        : {}),
    });
    const validated = courseDocumentExtractionSchema.parse(extraction);
    const completedAt = new Date();
    const saved = await prisma.$transaction(async (transaction) => {
      await transaction.extractionDraft.upsert({
        where: { extractionJobId: job.id },
        create: {
          extractionJobId: job.id,
          draftPayload: validated,
          overallConfidence: validated.overallConfidence,
        },
        update: {
          draftPayload: validated,
          overallConfidence: validated.overallConfidence,
          createdAt: completedAt,
        },
      });
      return transaction.extractionJob.update({
        where: { id: job.id },
        data: {
          status: 'REVIEW_REQUIRED',
          modelIdentifier: provider.modelIdentifier,
          extractorVersion: validated.extractorVersion,
          schemaVersion: validated.schemaVersion,
          completedAt,
          failureReason: null,
        },
        include: extractionJobInclude,
      });
    });
    return saved as unknown as ExtractionJobRecord;
  } catch (error) {
    const failureReason =
      error instanceof ExtractionParseError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? `EXTRACTION_FAILED: ${error.message}`
          : 'EXTRACTION_FAILED: Extraction failed.';
    const failed = await prisma.extractionJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        failureReason,
      },
      include: extractionJobInclude,
    });
    return failed as unknown as ExtractionJobRecord;
  }
}

export function registerExtractionJobRoutes(app: express.Application) {
  app.get('/api/extraction-jobs/:jobId', async (request, response) => {
    const userId = await requireUserId(request, response);
    if (!userId || !prisma) return;
    const job = await ownedJob(request.params.jobId, userId);
    if (!job) {
      response.status(404).json({ error: 'EXTRACTION_JOB_NOT_FOUND' });
      return;
    }
    response.status(200).json({ extractionJob: serializeExtractionJob(job) });
  });

  app.post('/api/extraction-jobs/:jobId/process', async (request, response) => {
    const userId = await requireUserId(request, response);
    if (!userId || !prisma) return;
    const job = await processExtractionJob(request.params.jobId, userId);
    if (!job) {
      response.status(404).json({ error: 'EXTRACTION_JOB_NOT_FOUND' });
      return;
    }
    response.status(200).json({ extractionJob: serializeExtractionJob(job) });
  });
}
