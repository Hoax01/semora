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
  diffExtractionPayloads,
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
    activeCourseState: {
      id: string;
      outlineDocumentId: string | null;
      instructorDisplay: string | null;
    } | null;
    courseOffering: {
      course: { courseCode: string; title: string };
    } | null;
  };
  draft: {
    id: string;
    draftPayload: unknown;
    initialPayload: unknown | null;
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
    include: {
      activeCourseState: true,
      courseOffering: { include: { course: true } },
    },
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
          payload: courseDocumentExtractionSchema.parse(job.draft.draftPayload),
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
        initialPayload:
          job.draft?.initialPayload ?? job.draft?.draftPayload ?? validated.extraction,
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
  return {
    job: saved as unknown as ExtractionJobRecord,
    validation: validated,
    previousPayload: job.draft?.draftPayload ?? null,
  };
}

function normalizedLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function categoryForAssessment(
  assessment: CourseDocumentExtraction['assessments'][number],
  categories: CourseDocumentExtraction['gradingScheme']['categories'],
) {
  if (assessment.category) {
    const explicitCategory = categories.find(
      (category) => normalizedLabel(category.name) === normalizedLabel(assessment.category ?? ''),
    );
    if (explicitCategory) return explicitCategory;
  }
  if (categories.length === 1) return categories[0];
  const title = normalizedLabel(assessment.title);
  const type = normalizedLabel(assessment.type);
  return categories.find((category) => {
    const label = normalizedLabel(category.name);
    return (
      title.includes(label) ||
      label.includes(type) ||
      (assessment.type === 'ASSIGNMENT' && /assignment|coursework|homework|lab/.test(label)) ||
      (assessment.type === 'QUIZ' && label.includes('quiz')) ||
      (assessment.type === 'PROJECT' && label.includes('project')) ||
      (assessment.type === 'PRESENTATION' && label.includes('presentation')) ||
      (assessment.type === 'MIDTERM' && /midterm|mid term/.test(label)) ||
      (assessment.type === 'FINAL' && /final|exam/.test(label)) ||
      (assessment.type === 'PARTICIPATION' && label.includes('participation'))
    );
  });
}

async function persistCanonicalAcademicData(
  job: ExtractionJobRecord,
  userId: string,
  extraction: CourseDocumentExtraction,
  verificationState: 'VERIFIED' | 'VERIFIED_WITH_GAPS',
) {
  if (!prisma || !job.document.activeCourseState) return null;

  const activeCourseStateId = job.document.activeCourseState.id;
  const sourceDocumentId = job.document.id;
  const categoryWeights = extraction.gradingScheme.categories.map(
    (category) => category.weightPercentage,
  );
  const totalExpectedWeight = categoryWeights.every((weight) => weight !== null)
    ? categoryWeights.reduce((total, weight) => total + (weight ?? 0), 0)
    : null;
  const completenessFields = [
    Boolean(extraction.courseIdentity.courseCode),
    Boolean(extraction.courseIdentity.title),
    extraction.gradingScheme.categories.length > 0,
    extraction.assessments.length > 0,
    extraction.gradingScheme.gradingMode !== 'UNKNOWN',
  ];
  const dataCompleteness = completenessFields.filter(Boolean).length / completenessFields.length;

  return prisma.$transaction(async (transaction) => {
    const activeCourseState = await transaction.activeCourseState.findUnique({
      where: { id: activeCourseStateId },
      select: { outlineDocumentId: true },
    });
    if (!activeCourseState || activeCourseState.outlineDocumentId !== sourceDocumentId) {
      return null;
    }

    await transaction.assessment.deleteMany({ where: { activeCourseStateId } });
    await transaction.workloadSignal.deleteMany({ where: { activeCourseStateId } });
    await transaction.gradingScheme.deleteMany({ where: { activeCourseStateId } });

    const gradingScheme = await transaction.gradingScheme.create({
      data: {
        activeCourseStateId,
        gradingMode: extraction.gradingScheme.gradingMode,
        totalExpectedWeight,
        sourceType: 'VERIFIED_OUTLINE',
        sourceDocumentId,
        verified: true,
      },
    });

    const categoryIds = new Map<string, string>();
    for (const [displayOrder, category] of extraction.gradingScheme.categories.entries()) {
      const savedCategory = await transaction.gradeCategory.create({
        data: {
          gradingSchemeId: gradingScheme.id,
          name: category.name,
          weightPercentage: category.weightPercentage,
          aggregationRule: category.aggregationRule,
          ruleParameterN: category.ruleParameterN,
          displayOrder,
        },
      });
      categoryIds.set(normalizedLabel(category.name), savedCategory.id);
    }

    if (extraction.gradingScheme.thresholds.length > 0) {
      await transaction.gradeThreshold.createMany({
        data: extraction.gradingScheme.thresholds.map((threshold) => ({
          gradingSchemeId: gradingScheme.id,
          letterGrade: threshold.label,
          minimumPercentage: threshold.minimumPercentage,
          inclusive: true,
          sourceType: 'VERIFIED_OUTLINE' as const,
          sourceDocumentId,
        })),
      });
    }

    if (extraction.assessments.length > 0) {
      await transaction.assessment.createMany({
        data: extraction.assessments.map((assessment) => {
          const category = categoryForAssessment(assessment, extraction.gradingScheme.categories);
          return {
            activeCourseStateId,
            gradeCategoryId: category
              ? (categoryIds.get(normalizedLabel(category.name)) ?? null)
              : null,
            title: assessment.title,
            assessmentType: assessment.type,
            weightPercentage: assessment.weightPercentage,
            isGroupAssessment: assessment.isGroupAssessment,
            dueAt: assessment.dueDate ? new Date(`${assessment.dueDate}T00:00:00.000Z`) : null,
            datePrecision: assessment.dueDate ? ('EXACT' as const) : ('UNKNOWN' as const),
            sourceType: 'VERIFIED_OUTLINE' as const,
            sourceDocumentId,
          };
        }),
      });
    }

    const typeCounts = new Map<string, number>();
    for (const assessment of extraction.assessments) {
      typeCounts.set(assessment.type, (typeCounts.get(assessment.type) ?? 0) + 1);
    }
    const workloadSignals = [
      { signalType: 'ASSESSMENT_COUNT', value: extraction.assessments.length },
      ...Array.from(typeCounts, ([type, count]) => ({
        signalType: `ASSESSMENT_TYPE_${type}_COUNT`,
        value: count,
      })),
    ];
    await transaction.workloadSignal.createMany({
      data: workloadSignals.map((signal) => ({
        activeCourseStateId,
        signalType: signal.signalType,
        value: signal.value,
        confidence: extraction.overallConfidence,
        sourceDocumentId,
        sourceType: 'VERIFIED_OUTLINE' as const,
      })),
    });

    const originalPayload = job.draft?.initialPayload;
    const corrections = originalPayload ? diffExtractionPayloads(originalPayload, extraction) : [];
    if (corrections.length) {
      await transaction.extractionCorrection.createMany({
        data: corrections.map((correction) => ({
          extractionJobId: job.id,
          correctedByUserId: userId,
          fieldPath: correction.fieldPath,
          originalValue: correction.originalValue,
          correctedValue: correction.correctedValue,
        })),
      });
    }

    await transaction.activeCourseState.update({
      where: { id: activeCourseStateId },
      data: {
        instructorDisplay: extraction.courseIdentity.instructors.join(', ') || null,
        dataCompleteness,
        dataConfidence: extraction.overallConfidence,
      },
    });
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
}

async function updateVerifiedCanonicalAcademicData(
  job: ExtractionJobRecord,
  userId: string,
  extraction: CourseDocumentExtraction,
  verificationState: 'VERIFIED' | 'VERIFIED_WITH_GAPS',
  previousPayload: unknown,
) {
  if (!prisma || !job.document.activeCourseState) return null;

  const activeCourseStateId = job.document.activeCourseState.id;
  const sourceDocumentId = job.document.id;
  const categoryWeights = extraction.gradingScheme.categories.map(
    (category) => category.weightPercentage,
  );
  const totalExpectedWeight = categoryWeights.every((weight) => weight !== null)
    ? categoryWeights.reduce((total, weight) => total + (weight ?? 0), 0)
    : null;
  const completenessFields = [
    Boolean(extraction.courseIdentity.courseCode),
    Boolean(extraction.courseIdentity.title),
    extraction.gradingScheme.categories.length > 0,
    extraction.assessments.length > 0,
    extraction.gradingScheme.gradingMode !== 'UNKNOWN',
  ];
  const dataCompleteness = completenessFields.filter(Boolean).length / completenessFields.length;

  return prisma.$transaction(async (transaction) => {
    const activeCourseState = await transaction.activeCourseState.findUnique({
      where: { id: activeCourseStateId },
      include: {
        gradingScheme: {
          include: {
            categories: { orderBy: { displayOrder: 'asc' } },
            thresholds: { orderBy: { minimumPercentage: 'desc' } },
          },
        },
        assessments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            assessmentType: true,
            sourceType: true,
            sourceDocumentId: true,
          },
        },
      },
    });
    if (!activeCourseState || activeCourseState.outlineDocumentId !== sourceDocumentId) {
      return null;
    }

    let gradingSchemeId = activeCourseState.gradingScheme?.id;
    if (gradingSchemeId) {
      await transaction.gradingScheme.update({
        where: { id: gradingSchemeId },
        data: {
          gradingMode: extraction.gradingScheme.gradingMode,
          totalExpectedWeight,
          sourceType: 'VERIFIED_OUTLINE',
          sourceDocumentId,
          verified: true,
        },
      });
    } else {
      const gradingScheme = await transaction.gradingScheme.create({
        data: {
          activeCourseStateId,
          gradingMode: extraction.gradingScheme.gradingMode,
          totalExpectedWeight,
          sourceType: 'VERIFIED_OUTLINE',
          sourceDocumentId,
          verified: true,
        },
      });
      gradingSchemeId = gradingScheme.id;
    }

    const existingCategories = activeCourseState.gradingScheme?.categories ?? [];
    const categoryIds = new Map<string, string>();
    for (const [displayOrder, category] of extraction.gradingScheme.categories.entries()) {
      const existing = existingCategories[displayOrder];
      const savedCategory = existing
        ? await transaction.gradeCategory.update({
            where: { id: existing.id },
            data: {
              name: category.name,
              weightPercentage: category.weightPercentage,
              aggregationRule: category.aggregationRule,
              ruleParameterN: category.ruleParameterN,
              displayOrder,
            },
          })
        : await transaction.gradeCategory.create({
            data: {
              gradingSchemeId,
              name: category.name,
              weightPercentage: category.weightPercentage,
              aggregationRule: category.aggregationRule,
              ruleParameterN: category.ruleParameterN,
              displayOrder,
            },
          });
      categoryIds.set(normalizedLabel(category.name), savedCategory.id);
    }

    const existingThresholds = activeCourseState.gradingScheme?.thresholds ?? [];
    for (const [displayOrder, threshold] of extraction.gradingScheme.thresholds.entries()) {
      const existing = existingThresholds[displayOrder];
      if (existing) {
        await transaction.gradeThreshold.update({
          where: { id: existing.id },
          data: {
            letterGrade: threshold.label,
            minimumPercentage: threshold.minimumPercentage,
            inclusive: true,
            sourceType: 'VERIFIED_OUTLINE',
            sourceDocumentId,
          },
        });
      } else {
        await transaction.gradeThreshold.create({
          data: {
            gradingSchemeId,
            letterGrade: threshold.label,
            minimumPercentage: threshold.minimumPercentage,
            inclusive: true,
            sourceType: 'VERIFIED_OUTLINE',
            sourceDocumentId,
          },
        });
      }
    }

    const existingOutlineAssessments = activeCourseState.assessments.filter(
      (assessment) =>
        assessment.sourceType === 'VERIFIED_OUTLINE' &&
        assessment.sourceDocumentId === sourceDocumentId,
    );
    for (const [displayOrder, assessment] of extraction.assessments.entries()) {
      const category = categoryForAssessment(assessment, extraction.gradingScheme.categories);
      const data = {
        gradeCategoryId: category
          ? (categoryIds.get(normalizedLabel(category.name)) ?? null)
          : null,
        title: assessment.title,
        assessmentType: assessment.type,
        weightPercentage: assessment.weightPercentage,
        isGroupAssessment: assessment.isGroupAssessment,
        dueAt: assessment.dueDate ? new Date(`${assessment.dueDate}T00:00:00.000Z`) : null,
        datePrecision: assessment.dueDate ? ('EXACT' as const) : ('UNKNOWN' as const),
        sourceType: 'VERIFIED_OUTLINE' as const,
        sourceDocumentId,
      };
      const existing = existingOutlineAssessments[displayOrder];
      if (existing) {
        await transaction.assessment.update({ where: { id: existing.id }, data });
      } else {
        await transaction.assessment.create({ data: { activeCourseStateId, ...data } });
      }
    }

    if (previousPayload) {
      const corrections = diffExtractionPayloads(previousPayload, extraction);
      if (corrections.length) {
        await transaction.extractionCorrection.createMany({
          data: corrections.map((correction) => ({
            extractionJobId: job.id,
            correctedByUserId: userId,
            fieldPath: correction.fieldPath,
            originalValue: correction.originalValue,
            correctedValue: correction.correctedValue,
          })),
        });
      }
    }

    await transaction.activeCourseState.update({
      where: { id: activeCourseStateId },
      data: {
        instructorDisplay: extraction.courseIdentity.instructors.join(', ') || null,
        dataCompleteness,
        dataConfidence: extraction.overallConfidence,
      },
    });
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
          initialPayload: validated,
          overallConfidence: validated.overallConfidence,
        },
        update: {
          draftPayload: validated,
          initialPayload: validated,
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
    if (!['REVIEW_REQUIRED', 'VERIFIED'].includes(job.status)) {
      response.status(409).json({ error: 'EXTRACTION_REVIEW_NOT_AVAILABLE' });
      return;
    }
    if (
      !job.document.activeCourseState ||
      job.document.activeCourseState.outlineDocumentId !== job.document.id
    ) {
      response.status(409).json({ error: 'EXTRACTION_DOCUMENT_NOT_CURRENT' });
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
    if (!['REVIEW_REQUIRED', 'VERIFIED'].includes(job.status)) {
      response.status(409).json({ error: 'EXTRACTION_REVIEW_NOT_AVAILABLE' });
      return;
    }
    if (!job.document.activeCourseState) {
      response.status(409).json({ error: 'EXTRACTION_DOCUMENT_NOT_CURRENT' });
      return;
    }
    if (job.document.activeCourseState.outlineDocumentId !== job.document.id) {
      response.status(409).json({ error: 'EXTRACTION_DOCUMENT_NOT_CURRENT' });
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
    const verified =
      saved.job.status === 'VERIFIED'
        ? await updateVerifiedCanonicalAcademicData(
            saved.job,
            userId,
            saved.validation.extraction,
            verificationState,
            saved.previousPayload,
          )
        : await persistCanonicalAcademicData(
            saved.job,
            userId,
            saved.validation.extraction,
            verificationState,
          );
    if (!verified) {
      response.status(409).json({ error: 'EXTRACTION_DOCUMENT_NOT_CURRENT' });
      return;
    }
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
