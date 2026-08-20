import { readFile } from 'node:fs/promises';
import type express from 'express';
import {
  ExtractionParseError,
  LocalDeterministicExtractionProvider,
  parseDocument,
  courseDocumentExtractionSchema,
  type AcademicExtractionProvider,
  type CourseDocumentExtraction,
  SchemaConstrainedExtractionProvider,
  validateCourseDocumentExtraction,
} from '@semora/extraction';
import { prisma } from './db.js';
import { privateDocumentPath } from './document-storage.js';
import { requireUserId } from './session.js';

const defaultProvider: AcademicExtractionProvider = new SchemaConstrainedExtractionProvider(
  new LocalDeterministicExtractionProvider(),
);

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
  verification: {
    id: string;
    verifiedByUserId: string;
    verifiedAt: Date;
    verificationState: string;
  } | null;
};

const extractionJobInclude = {
  document: {
    include: { courseOffering: { include: { course: true } } },
  },
  draft: true,
  verification: true,
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
    verification: job.verification
      ? {
          id: job.verification.id,
          state: job.verification.verificationState,
          verifiedByUserId: job.verification.verifiedByUserId,
          verifiedAt: job.verification.verifiedAt.toISOString(),
        }
      : null,
  };
}

function validationContext(job: ExtractionJobRecord) {
  return {
    ...(job.document.courseOffering?.course.courseCode
      ? { expectedCourseCode: job.document.courseOffering.course.courseCode }
      : {}),
    ...(job.document.courseOffering?.course.title
      ? { expectedCourseTitle: job.document.courseOffering.course.title }
      : {}),
  };
}

function parseReviewPayload(payload: unknown) {
  const parsed = courseDocumentExtractionSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      error: 'EXTRACTION_DRAFT_INVALID' as const,
      details: parsed.error.issues,
    };
  }
  return { extraction: parsed.data };
}

async function saveReviewedDraft(job: ExtractionJobRecord, extraction: CourseDocumentExtraction) {
  if (!prisma) return null;
  const validated = validateCourseDocumentExtraction(extraction, validationContext(job));
  const saved = await prisma.$transaction(async (transaction) => {
    await transaction.extractionDraft.upsert({
      where: { extractionJobId: job.id },
      create: {
        extractionJobId: job.id,
        draftPayload: validated.extraction,
        overallConfidence: validated.extraction.overallConfidence,
      },
      update: {
        draftPayload: validated.extraction,
        overallConfidence: validated.extraction.overallConfidence,
        createdAt: new Date(),
      },
    });
    return transaction.extractionJob.findUniqueOrThrow({
      where: { id: job.id },
      include: extractionJobInclude,
    });
  });
  return { job: saved as unknown as ExtractionJobRecord, validation: validated };
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
  provider: AcademicExtractionProvider = defaultProvider,
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
    const validated = validateCourseDocumentExtraction(extraction, {
      ...(job.document.courseOffering?.course.courseCode
        ? { expectedCourseCode: job.document.courseOffering.course.courseCode }
        : {}),
      ...(job.document.courseOffering?.course.title
        ? { expectedCourseTitle: job.document.courseOffering.course.title }
        : {}),
    }).extraction;
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
      await transaction.extractionVerification.deleteMany({ where: { extractionJobId: job.id } });
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

  app.put('/api/extraction-jobs/:jobId/review', async (request, response) => {
    const userId = await requireUserId(request, response);
    if (!userId || !prisma) return;
    const job = await ownedJob(request.params.jobId, userId);
    if (!job) {
      response.status(404).json({ error: 'EXTRACTION_JOB_NOT_FOUND' });
      return;
    }
    if (job.status !== 'REVIEW_REQUIRED') {
      response.status(409).json({ error: 'EXTRACTION_REVIEW_NOT_AVAILABLE' });
      return;
    }
    const parsed = parseReviewPayload(request.body?.payload);
    if ('error' in parsed) {
      response.status(400).json(parsed);
      return;
    }
    const saved = await saveReviewedDraft(job, parsed.extraction);
    if (!saved) return;
    response.status(200).json({
      extractionJob: serializeExtractionJob(saved.job),
      blockingIssues: saved.validation.blockingIssues,
      valid: saved.validation.valid,
    });
  });

  app.post('/api/extraction-jobs/:jobId/verify', async (request, response) => {
    const userId = await requireUserId(request, response);
    if (!userId || !prisma) return;
    const job = await ownedJob(request.params.jobId, userId);
    if (!job) {
      response.status(404).json({ error: 'EXTRACTION_JOB_NOT_FOUND' });
      return;
    }
    if (job.status !== 'REVIEW_REQUIRED') {
      response.status(409).json({ error: 'EXTRACTION_REVIEW_NOT_AVAILABLE' });
      return;
    }
    const parsed = parseReviewPayload(request.body?.payload);
    if ('error' in parsed) {
      response.status(400).json(parsed);
      return;
    }
    const saved = await saveReviewedDraft(job, parsed.extraction);
    if (!saved) return;
    if (!saved.validation.valid) {
      response.status(409).json({
        error: 'EXTRACTION_REVIEW_BLOCKED',
        blockingIssues: saved.validation.blockingIssues,
        extractionJob: serializeExtractionJob(saved.job),
      });
      return;
    }
    const verificationState = saved.validation.extraction.warnings.length
      ? 'VERIFIED_WITH_GAPS'
      : 'VERIFIED';
    const verified = await prisma.$transaction(async (transaction) => {
      await transaction.extractionVerification.upsert({
        where: { extractionJobId: job.id },
        create: {
          extractionJobId: job.id,
          verifiedByUserId: userId,
          verificationState,
        },
        update: {
          verifiedByUserId: userId,
          verifiedAt: new Date(),
          verificationState,
        },
      });
      return transaction.extractionJob.update({
        where: { id: job.id },
        data: { status: 'VERIFIED', failureReason: null, completedAt: new Date() },
        include: extractionJobInclude,
      });
    });
    response
      .status(200)
      .json({ extractionJob: serializeExtractionJob(verified as unknown as ExtractionJobRecord) });
  });

  app.post('/api/extraction-jobs/:jobId/reject', async (request, response) => {
    const userId = await requireUserId(request, response);
    if (!userId || !prisma) return;
    const job = await ownedJob(request.params.jobId, userId);
    if (!job) {
      response.status(404).json({ error: 'EXTRACTION_JOB_NOT_FOUND' });
      return;
    }
    if (job.status !== 'REVIEW_REQUIRED') {
      response.status(409).json({ error: 'EXTRACTION_REVIEW_NOT_AVAILABLE' });
      return;
    }
    const rejected = await prisma.$transaction(async (transaction) => {
      await transaction.extractionVerification.upsert({
        where: { extractionJobId: job.id },
        create: {
          extractionJobId: job.id,
          verifiedByUserId: userId,
          verificationState: 'REJECTED',
        },
        update: {
          verifiedByUserId: userId,
          verifiedAt: new Date(),
          verificationState: 'REJECTED',
        },
      });
      return transaction.extractionJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          failureReason: 'REJECTED_BY_USER: The extracted draft was rejected during review.',
        },
        include: extractionJobInclude,
      });
    });
    response
      .status(200)
      .json({ extractionJob: serializeExtractionJob(rejected as unknown as ExtractionJobRecord) });
  });
}
