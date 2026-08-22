import express from 'express';
import { z } from 'zod';
import {
  calculateGrade,
  calculateGradeScenario,
  type GradeAssessment,
  type GradeAssessmentStatus,
  type GradeCategory,
  type GradeCategoryResult,
  type GradeRelativeStatistic,
  type GradeAggregationRule as EngineGradeAggregationRule,
  type GradeScenarioOverride,
  type GradeTargetAnalysis,
} from '@semora/grade-engine';
import { DEFAULT_WORKLOAD_ENGINE_CONFIG, type AssessmentType } from '@semora/workload-engine';
import { prisma } from './db.js';
import { requireUserId } from './session.js';

const assessmentTypes = [
  'ASSIGNMENT',
  'QUIZ',
  'PROJECT',
  'PRESENTATION',
  'MIDTERM',
  'FINAL',
  'PARTICIPATION',
  'OTHER',
] as const;
const workStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'DONE'] as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const assessmentFields = z.object({
  title: z.string().trim().min(1).max(160),
  assessmentType: z.enum(assessmentTypes),
  weightPercentage: z.number().finite().min(0).max(100).nullable().optional(),
  pointsPossible: z.number().finite().positive().nullable().optional(),
  dueDate: z.string().regex(datePattern).nullable().optional(),
  datePrecision: z.enum(['EXACT', 'UNKNOWN']).optional(),
  workStatus: z.enum(workStatuses).optional(),
  progressPercentage: z.number().finite().min(0).max(100).nullable().optional(),
  personalEffortHours: z.number().finite().min(0).max(168).nullable().optional(),
});

const createAssessmentSchema = assessmentFields.superRefine((value, context) => {
  if (value.dueDate == null && value.datePrecision === 'EXACT') {
    context.addIssue({
      code: 'custom',
      path: ['datePrecision'],
      message: 'An exact assessment date is required when date precision is EXACT.',
    });
  }
  if (value.dueDate && value.datePrecision === 'UNKNOWN') {
    context.addIssue({
      code: 'custom',
      path: ['datePrecision'],
      message: 'Unknown date precision cannot include an exact due date.',
    });
  }
  if (value.dueDate && !isValidDateInput(value.dueDate)) {
    context.addIssue({
      code: 'custom',
      path: ['dueDate'],
      message: 'Due date must be a real calendar date.',
    });
  }
});

const updateAssessmentSchema = assessmentFields.partial().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: 'custom', message: 'At least one assessment field is required.' });
  }
  if (value.dueDate == null && value.datePrecision === 'EXACT') {
    context.addIssue({
      code: 'custom',
      path: ['datePrecision'],
      message: 'An exact assessment date is required when date precision is EXACT.',
    });
  }
  if (value.dueDate && value.datePrecision === 'UNKNOWN') {
    context.addIssue({
      code: 'custom',
      path: ['datePrecision'],
      message: 'Unknown date precision cannot include an exact due date.',
    });
  }
  if (value.dueDate && !isValidDateInput(value.dueDate)) {
    context.addIssue({
      code: 'custom',
      path: ['dueDate'],
      message: 'Due date must be a real calendar date.',
    });
  }
});

const scoreSchema = z
  .object({
    pointsEarned: z.number().finite().min(0).nullable().optional(),
    percentage: z.number().finite().min(0).max(100).nullable().optional(),
  })
  .superRefine((value, context) => {
    const hasPoints = value.pointsEarned !== null && value.pointsEarned !== undefined;
    const hasPercentage = value.percentage !== null && value.percentage !== undefined;
    if (hasPoints === hasPercentage) {
      context.addIssue({
        code: 'custom',
        path: ['score'],
        message: 'Provide exactly one of pointsEarned or percentage.',
      });
    }
  });

const classStatisticsSchema = z
  .object({
    mean: z.number().finite().min(0).max(100),
    median: z.number().finite().min(0).max(100).nullable().optional(),
    standardDeviation: z.number().finite().min(0).max(100).nullable().optional(),
    minimum: z.number().finite().min(0).max(100).nullable().optional(),
    maximum: z.number().finite().min(0).max(100).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.minimum !== null &&
      value.minimum !== undefined &&
      value.maximum !== null &&
      value.maximum !== undefined &&
      value.minimum > value.maximum
    ) {
      context.addIssue({
        code: 'custom',
        path: ['minimum'],
        message: 'Minimum cannot exceed maximum.',
      });
    }
  });

const gradeScenarioSchema = z
  .object({
    courseOfferingId: z.string().trim().min(1),
    overrides: z
      .array(
        z.object({
          assessmentId: z.string().trim().min(1),
          percentage: z.number().finite().min(0).max(100),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const [index, override] of value.overrides.entries()) {
      if (ids.has(override.assessmentId)) {
        context.addIssue({
          code: 'custom',
          path: ['overrides', index, 'assessmentId'],
          message: 'Each assessment can only have one hypothetical result.',
        });
      }
      ids.add(override.assessmentId);
    }
  });
const assessmentInclude = {
  scores: true,
  classStatistic: true,
  activeCourseState: {
    include: {
      gradingScheme: { include: { categories: true, thresholds: true } },
      assessments: { select: { id: true, gradeCategoryId: true, status: true } },
      activeCourseSelection: {
        include: {
          section: {
            include: { courseOffering: { include: { course: true } } },
          },
        },
      },
    },
  },
} as const;

type AssessmentRecord = {
  id: string;
  activeCourseStateId: string;
  gradeCategoryId: string | null;
  title: string;
  assessmentType: string;
  weightPercentage: { toString(): string } | null;
  pointsPossible: { toString(): string } | null;
  dueAt: Date | null;
  datePrecision: string;
  status: string;
  workStatus: string;
  progressPercentage: { toString(): string } | null;
  estimatedEffortHours: { toString(): string } | null;
  effortConfidence: { toString(): string } | null;
  personalEffortHours: { toString(): string } | null;
  personalEffortConfidence: { toString(): string } | null;
  isGroupAssessment: boolean;
  sourceType: string;
  sourceDocumentId: string | null;
  classStatistic: {
    id: string;
    mean: { toString(): string };
    median: { toString(): string } | null;
    standardDeviation: { toString(): string } | null;
    minimum: { toString(): string } | null;
    maximum: { toString(): string } | null;
    sourceType: string;
    recordedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  scores: Array<{
    id: string;
    userId: string;
    pointsEarned: { toString(): string } | null;
    percentageOverride: { toString(): string } | null;
    recordedAt: Date;
    sourceType: string;
  }>;

  activeCourseState: {
    assessments: Array<{
      id: string;
      gradeCategoryId: string | null;
      status: string;
    }>;
    gradingScheme: {
      gradingMode: string;
      totalExpectedWeight: { toString(): string } | null;
      categories: Array<{
        id: string;
        name: string;
        weightPercentage: { toString(): string } | null;
        aggregationRule: string;
        ruleParameterN: number | null;
      }>;
      thresholds: Array<{
        letterGrade: string;
        minimumPercentage: { toString(): string };
        inclusive: boolean;
      }>;
    } | null;
    activeCourseSelection: {
      id: string;
      section: {
        courseOffering: {
          id: string;
          course: { courseCode: string; title: string };
        };
      };
    };
  };
};

function validationError(response: express.Response, details: unknown) {
  response.status(400).json({ error: 'VALIDATION_ERROR', details });
}

function dateFromInput(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function isValidDateInput(value: string) {
  const parsed = dateFromInput(value);
  return (
    parsed !== null &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function decimalOrNull(value: { toString(): string } | null) {
  return value === null ? null : Number(value);
}

function categoryForAssessment(assessment: AssessmentRecord) {
  return assessment.activeCourseState.gradingScheme?.categories.find(
    (category) => category.id === assessment.gradeCategoryId,
  );
}

function effectiveWeightForAssessment(assessment: AssessmentRecord) {
  const category = categoryForAssessment(assessment);
  if (category?.aggregationRule === 'EQUAL_MEAN' && category.weightPercentage !== null) {
    const categoryAssessmentCount = assessment.activeCourseState.assessments.filter(
      (candidate) => candidate.gradeCategoryId === category.id && candidate.status !== 'CANCELLED',
    ).length;
    return categoryAssessmentCount > 0
      ? Number(category.weightPercentage) / categoryAssessmentCount
      : null;
  }
  return decimalOrNull(assessment.weightPercentage);
}

function gradeStatusFor(status: string): GradeAssessmentStatus {
  switch (status) {
    case 'GRADED':
      return 'GRADED';
    case 'SUBMITTED':
      return 'SUBMITTED_UNGRADED';
    case 'MISSING':
      return 'MISSING';
    case 'EXCUSED':
      return 'EXCUSED';
    case 'DROPPED':
      return 'DROPPED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'UPCOMING';
  }
}

function aggregationRuleFor(rule: string): EngineGradeAggregationRule {
  switch (rule) {
    case 'EQUAL_MEAN':
      return 'EQUAL_MEAN';
    case 'POINTS_WEIGHTED_MEAN':
      return 'POINTS_WEIGHTED_MEAN';
    case 'BEST_N':
      return 'BEST_N';
    case 'DROP_LOWEST_N':
      return 'DROP_LOWEST_N';
    default:
      return 'EXPLICIT_ASSESSMENT_WEIGHTS';
  }
}

function calculateGradeSummaries(
  assessments: AssessmentRecord[],
  userId: string,
  scenarioOverrides: readonly GradeScenarioOverride[] = [],
) {
  const byCourse = new Map<string, AssessmentRecord[]>();
  for (const assessment of assessments) {
    const courseOfferingId =
      assessment.activeCourseState.activeCourseSelection.section.courseOffering.id;
    const courseAssessments = byCourse.get(courseOfferingId) ?? [];
    courseAssessments.push(assessment);
    byCourse.set(courseOfferingId, courseAssessments);
  }

  return [...byCourse.entries()].map(([courseOfferingId, courseAssessments]) => {
    const firstAssessment = courseAssessments[0] as AssessmentRecord;
    const courseOffering =
      firstAssessment.activeCourseState.activeCourseSelection.section.courseOffering;
    const gradingScheme = firstAssessment.activeCourseState.gradingScheme;
    const totalExpectedWeight =
      gradingScheme?.totalExpectedWeight === null ||
      gradingScheme?.totalExpectedWeight === undefined
        ? 100
        : Number(gradingScheme.totalExpectedWeight);
    const baseSummary = {
      courseOfferingId,
      courseCode: courseOffering.course.courseCode,
      courseTitle: courseOffering.course.title,
      gradingMode: gradingScheme?.gradingMode ?? 'UNKNOWN',
      totalExpectedWeight,
      assessmentCount: courseAssessments.filter((assessment) => assessment.status !== 'CANCELLED')
        .length,
      gradedAssessmentCount: courseAssessments.filter(
        (assessment) =>
          assessment.status === 'GRADED' &&
          assessment.scores.some(
            (score) =>
              score.userId === userId &&
              (score.pointsEarned !== null || score.percentageOverride !== null),
          ),
      ).length,
      weightedPointsEarned: null as number | null,
      gradedWeight: null as number | null,
      remainingWeight: null as number | null,
      currentPerformance: null as number | null,
      currentGrade: null as string | null,
      targetAnalyses: [] as GradeTargetAnalysis[],
      categories: [] as GradeCategoryResult[],
      relativeStatistics: [] as GradeRelativeStatistic[],
      remainingAssessments: courseAssessments
        .filter(
          (assessment) =>
            !['GRADED', 'EXCUSED', 'DROPPED', 'CANCELLED'].includes(assessment.status),
        )
        .map((assessment) => ({
          assessmentId: assessment.id,
          title: assessment.title,
          assessmentType: assessment.assessmentType,
          dueDate: assessment.dueAt?.toISOString().slice(0, 10) ?? null,
          datePrecision: assessment.datePrecision,
          weightPercentage: effectiveWeightForAssessment(assessment),
          status: assessment.status,
        })),
      warnings: [
        ...(gradingScheme?.gradingMode === 'ABSOLUTE' &&
        (gradingScheme.thresholds?.length ?? 0) === 0
          ? ['Absolute grade thresholds are not confirmed for this course.']
          : []),
      ] as string[],
    };

    const categories: GradeCategory[] = (gradingScheme?.categories ?? [])
      .filter((category) => category.weightPercentage !== null)
      .map((category) => ({
        id: category.id,
        name: category.name,
        weightPercentage: Number(category.weightPercentage),
        aggregationRule: aggregationRuleFor(category.aggregationRule),
        ruleParameterN: category.ruleParameterN,
      }));
    const categoryIds = new Set(categories.map((category) => category.id));
    const engineAssessments: GradeAssessment[] = courseAssessments.map((assessment) => {
      const score = assessment.scores.find((candidate) => candidate.userId === userId) ?? null;
      return {
        id: assessment.id,
        title: assessment.title,
        categoryId:
          assessment.gradeCategoryId && categoryIds.has(assessment.gradeCategoryId)
            ? assessment.gradeCategoryId
            : null,
        weightPercentage: decimalOrNull(assessment.weightPercentage),
        pointsPossible: decimalOrNull(assessment.pointsPossible),
        status: gradeStatusFor(assessment.status),
        score: score
          ? {
              pointsEarned: decimalOrNull(score.pointsEarned),
              percentage: decimalOrNull(score.percentageOverride),
              pointsPossible: decimalOrNull(assessment.pointsPossible),
            }
          : null,
        classStatistics: assessment.classStatistic
          ? {
              mean: decimalOrNull(assessment.classStatistic.mean) as number,
              median: decimalOrNull(assessment.classStatistic.median),
              standardDeviation: decimalOrNull(assessment.classStatistic.standardDeviation),
              minimum: decimalOrNull(assessment.classStatistic.minimum),
              maximum: decimalOrNull(assessment.classStatistic.maximum),
            }
          : null,
      };
    });

    try {
      const gradeInput = {
        totalExpectedWeight,
        ...(gradingScheme?.gradingMode === 'ABSOLUTE'
          ? {
              gradingMode: 'ABSOLUTE' as const,
              thresholds: (gradingScheme.thresholds ?? []).map((threshold) => ({
                letterGrade: threshold.letterGrade,
                minimumPercentage: Number(threshold.minimumPercentage),
                inclusive: threshold.inclusive,
              })),
            }
          : {}),
        categories,
        assessments: engineAssessments,
      };
      const result = scenarioOverrides.length
        ? calculateGradeScenario(gradeInput, scenarioOverrides)
        : calculateGrade(gradeInput);
      const categoryGradedCount = result.categories.reduce(
        (sum, category) => sum + category.gradedAssessmentCount,
        0,
      );
      return {
        ...baseSummary,
        weightedPointsEarned: result.weightedPointsEarned,
        gradedWeight: result.gradedWeight,
        remainingWeight: result.remainingWeight,
        currentPerformance: result.currentPerformance,
        currentGrade: result.currentGrade,
        targetAnalyses: result.targetAnalyses,
        categories: result.categories,
        relativeStatistics: result.relativeStatistics,
        gradedAssessmentCount:
          categoryGradedCount +
          result.assessments.filter((assessment) => assessment.reason === 'GRADED').length,
        warnings: [...baseSummary.warnings, ...result.warnings],
      };
    } catch (error) {
      return {
        ...baseSummary,
        warnings: [
          error instanceof Error
            ? error.message
            : 'Current performance could not be calculated from the available assessment data.',
        ],
      };
    }
  });
}
function serializeAssessment(assessment: AssessmentRecord, userId: string) {
  const score = assessment.scores.find((candidate) => candidate.userId === userId) ?? null;
  const personalEffortHours = decimalOrNull(assessment.personalEffortHours);
  const outlineEffortHours = decimalOrNull(assessment.estimatedEffortHours);
  const defaultEffortHours =
    DEFAULT_WORKLOAD_ENGINE_CONFIG.effortDefaults[assessment.assessmentType as AssessmentType];
  const effortSource =
    personalEffortHours !== null
      ? 'PERSONAL_ESTIMATE'
      : outlineEffortHours !== null
        ? 'OUTLINE_ESTIMATE'
        : defaultEffortHours !== null
          ? 'GENERIC_DEFAULT'
          : 'UNKNOWN';
  const category = categoryForAssessment(assessment);
  const effectiveWeightPercentage = effectiveWeightForAssessment(assessment);
  const weightIsDerived =
    category?.aggregationRule === 'EQUAL_MEAN' && effectiveWeightPercentage !== null;
  return {
    id: assessment.id,
    activeSelectionId: assessment.activeCourseState.activeCourseSelection.id,
    courseOfferingId: assessment.activeCourseState.activeCourseSelection.section.courseOffering.id,
    courseCode:
      assessment.activeCourseState.activeCourseSelection.section.courseOffering.course.courseCode,
    courseTitle:
      assessment.activeCourseState.activeCourseSelection.section.courseOffering.course.title,
    title: assessment.title,
    assessmentType: assessment.assessmentType,
    weightPercentage: decimalOrNull(assessment.weightPercentage),
    effectiveWeightPercentage,
    weightIsDerived,
    pointsPossible: decimalOrNull(assessment.pointsPossible),
    score: score
      ? {
          id: score.id,
          pointsEarned: decimalOrNull(score.pointsEarned),
          percentage: decimalOrNull(score.percentageOverride),
          recordedAt: score.recordedAt.toISOString(),
          sourceType: score.sourceType,
        }
      : null,

    dueDate: assessment.dueAt?.toISOString().slice(0, 10) ?? null,
    datePrecision: assessment.datePrecision,
    status: assessment.status,
    workStatus: assessment.workStatus,
    progressPercentage: decimalOrNull(assessment.progressPercentage),
    estimatedEffortHours: personalEffortHours ?? outlineEffortHours ?? defaultEffortHours,
    effortConfidence:
      effortSource === 'PERSONAL_ESTIMATE'
        ? (decimalOrNull(assessment.personalEffortConfidence) ??
          DEFAULT_WORKLOAD_ENGINE_CONFIG.explicitEffortConfidence)
        : (decimalOrNull(assessment.effortConfidence) ??
          (effortSource === 'GENERIC_DEFAULT'
            ? DEFAULT_WORKLOAD_ENGINE_CONFIG.defaultEffortConfidence
            : null)),
    effortSource,
    personalEffortHours,
    isGroupAssessment: assessment.isGroupAssessment,
    sourceType: assessment.sourceType,
    sourceDocumentId: assessment.sourceDocumentId,
    classStatistics: assessment.classStatistic
      ? {
          mean: decimalOrNull(assessment.classStatistic.mean),
          median: decimalOrNull(assessment.classStatistic.median),
          standardDeviation: decimalOrNull(assessment.classStatistic.standardDeviation),
          minimum: decimalOrNull(assessment.classStatistic.minimum),
          maximum: decimalOrNull(assessment.classStatistic.maximum),
          sourceType: assessment.classStatistic.sourceType,
          recordedAt: assessment.classStatistic.recordedAt.toISOString(),
        }
      : null,
    createdAt: assessment.createdAt.toISOString(),
    updatedAt: assessment.updatedAt.toISOString(),
  };
}

async function loadOwnedActiveSelection(selectionId: string, userId: string) {
  return prisma?.activeCourseSelection.findFirst({
    where: {
      id: selectionId,
      status: 'ACTIVE',
      workspace: { userId, state: 'ACTIVE' },
    },
    select: { id: true, workspaceId: true, state: { select: { id: true } } },
  });
}

async function loadOwnedAssessment(assessmentId: string, userId: string) {
  return prisma?.assessment.findFirst({
    where: {
      id: assessmentId,
      activeCourseState: {
        activeCourseSelection: { status: 'ACTIVE', workspace: { userId, state: 'ACTIVE' } },
      },
    },
    include: assessmentInclude,
  }) as Promise<AssessmentRecord | null> | undefined;
}

function workStateUpdate(
  workStatus: (typeof workStatuses)[number] | undefined,
  progressPercentage: number | null | undefined,
) {
  const update: {
    workStatus?: (typeof workStatuses)[number];
    progressPercentage?: number | null;
  } = {};
  if (workStatus !== undefined) update.workStatus = workStatus;
  if (progressPercentage !== undefined) update.progressPercentage = progressPercentage;
  if (workStatus === 'DONE') update.progressPercentage = 100;
  if (progressPercentage === 100) update.workStatus = 'DONE';
  if (
    progressPercentage !== null &&
    progressPercentage !== undefined &&
    progressPercentage > 0 &&
    workStatus === undefined
  ) {
    update.workStatus = 'IN_PROGRESS';
  }
  return update;
}

export function registerAssessmentRoutes(app: express.Express) {
  app.get('/api/workspaces/:workspaceId/assessments', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const workspace = await prisma.semesterWorkspace.findFirst({
      where: { id: request.params.workspaceId, userId, state: 'ACTIVE' },
      select: { id: true },
    });
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const assessments = await prisma.assessment.findMany({
      where: {
        activeCourseState: {
          activeCourseSelection: { workspaceId: workspace.id, status: 'ACTIVE' },
        },
      },
      include: assessmentInclude,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    });
    response.status(200).json({
      assessments: assessments.map((assessment) =>
        serializeAssessment(assessment as AssessmentRecord, userId),
      ),
      gradeSummaries: calculateGradeSummaries(assessments as AssessmentRecord[], userId),
    });
  });

  app.post('/api/workspaces/:workspaceId/grade-scenarios', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const parsed = gradeScenarioSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const workspace = await prisma.semesterWorkspace.findFirst({
      where: { id: request.params.workspaceId, userId, state: 'ACTIVE' },
      select: { id: true },
    });
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const assessments = (await prisma.assessment.findMany({
      where: {
        activeCourseState: {
          activeCourseSelection: {
            workspaceId: workspace.id,
            status: 'ACTIVE',
            section: { courseOfferingId: parsed.data.courseOfferingId },
          },
        },
      },
      include: assessmentInclude,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    })) as AssessmentRecord[];
    if (!assessments.length) {
      response.status(404).json({ error: 'COURSE_ASSESSMENTS_NOT_FOUND' });
      return;
    }

    const assessmentIds = new Set(assessments.map((assessment) => assessment.id));
    if (parsed.data.overrides.some((override) => !assessmentIds.has(override.assessmentId))) {
      response.status(400).json({ error: 'SCENARIO_ASSESSMENT_NOT_FOUND' });
      return;
    }

    const [gradeSummary] = calculateGradeSummaries(assessments, userId, parsed.data.overrides);
    response.status(200).json({ gradeSummary, persisted: false });
  });
  app.post('/api/active-selections/:selectionId/assessments', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const parsed = createAssessmentSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const selection = await loadOwnedActiveSelection(request.params.selectionId, userId);
    if (!selection) {
      response.status(404).json({ error: 'ACTIVE_SELECTION_NOT_FOUND' });
      return;
    }
    if (!selection.state) {
      response.status(409).json({ error: 'ACTIVE_COURSE_STATE_NOT_FOUND' });
      return;
    }

    const values = parsed.data;
    const workState = workStateUpdate(values.workStatus, values.progressPercentage);
    const assessment = await prisma.assessment.create({
      data: {
        activeCourseStateId: selection.state.id,
        title: values.title,
        assessmentType: values.assessmentType,
        weightPercentage: values.weightPercentage ?? null,
        pointsPossible: values.pointsPossible ?? null,
        dueAt: dateFromInput(values.dueDate),
        datePrecision: values.dueDate ? 'EXACT' : 'UNKNOWN',
        status: 'UPCOMING',
        workStatus: workState.workStatus ?? 'NOT_STARTED',
        progressPercentage: workState.progressPercentage ?? null,
        personalEffortHours: values.personalEffortHours ?? null,
        personalEffortConfidence: values.personalEffortHours == null ? null : 0.8,
        sourceType: 'USER_ENTERED',
      },
      include: assessmentInclude,
    });
    response
      .status(201)
      .json({ assessment: serializeAssessment(assessment as AssessmentRecord, userId) });
  });

  app.patch('/api/assessments/:assessmentId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const parsed = updateAssessmentSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const existing = await loadOwnedAssessment(request.params.assessmentId, userId);
    if (!existing) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    if (existing.status === 'CANCELLED') {
      response.status(409).json({ error: 'ASSESSMENT_CANCELLED' });
      return;
    }

    const values = parsed.data;
    const effectiveDueDate =
      values.dueDate === undefined
        ? (existing.dueAt?.toISOString().slice(0, 10) ?? null)
        : values.dueDate;
    if (values.datePrecision === 'UNKNOWN' && effectiveDueDate !== null) {
      validationError(response, {
        datePrecision: ['Unknown date precision requires no due date.'],
      });
      return;
    }
    if (values.datePrecision === 'EXACT' && effectiveDueDate === null) {
      validationError(response, { datePrecision: ['Exact date precision requires a due date.'] });
      return;
    }
    const workState = workStateUpdate(values.workStatus, values.progressPercentage);
    const category = categoryForAssessment(existing);
    const equalCategoryAssessmentCount = category
      ? existing.activeCourseState.assessments.filter(
          (candidate) =>
            candidate.gradeCategoryId === category.id && candidate.status !== 'CANCELLED',
        ).length
      : 0;
    const equalWeight =
      category?.aggregationRule === 'EQUAL_MEAN' &&
      category.weightPercentage !== null &&
      equalCategoryAssessmentCount > 0
        ? Number(category.weightPercentage) / equalCategoryAssessmentCount
        : null;
    const changesEqualWeight =
      values.weightPercentage !== undefined &&
      values.weightPercentage !== null &&
      equalWeight !== null &&
      Math.abs(values.weightPercentage - equalWeight) > 0.0001;
    const preservesEqualWeight = category?.aggregationRule === 'EQUAL_MEAN' && !changesEqualWeight;
    const assessment = await prisma.$transaction(async (transaction) => {
      if (changesEqualWeight && category && equalWeight !== null) {
        const categoryAssessments = await transaction.assessment.findMany({
          where: {
            activeCourseStateId: existing.activeCourseStateId,
            gradeCategoryId: category.id,
            status: { not: 'CANCELLED' },
          },
          select: { id: true },
        });
        await transaction.assessment.updateMany({
          where: { id: { in: categoryAssessments.map((candidate) => candidate.id) } },
          data: { weightPercentage: equalWeight },
        });
        await transaction.gradeCategory.update({
          where: { id: category.id },
          data: { aggregationRule: 'EXPLICIT_WEIGHTS' },
        });
      }
      return transaction.assessment.update({
        where: { id: existing.id },
        data: {
          ...(values.title === undefined ? {} : { title: values.title }),
          ...(values.assessmentType === undefined ? {} : { assessmentType: values.assessmentType }),
          ...(values.weightPercentage === undefined
            ? {}
            : {
                weightPercentage: preservesEqualWeight ? null : values.weightPercentage,
              }),
          ...(values.pointsPossible === undefined ? {} : { pointsPossible: values.pointsPossible }),
          ...(values.dueDate === undefined ? {} : { dueAt: dateFromInput(values.dueDate) }),
          ...(values.dueDate === undefined && values.datePrecision === undefined
            ? {}
            : { datePrecision: values.dueDate ? 'EXACT' : (values.datePrecision ?? 'UNKNOWN') }),
          ...(values.personalEffortHours === undefined
            ? {}
            : {
                personalEffortHours: values.personalEffortHours,
                personalEffortConfidence: values.personalEffortHours === null ? null : 0.8,
              }),
          ...workState,
        },
        include: assessmentInclude,
      });
    });
    response
      .status(200)
      .json({ assessment: serializeAssessment(assessment as AssessmentRecord, userId) });
  });

  app.put('/api/assessments/:assessmentId/class-statistics', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const parsed = classStatisticsSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const existing = await loadOwnedAssessment(request.params.assessmentId, userId);
    if (!existing) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    if (existing.status === 'CANCELLED') {
      response.status(409).json({ error: 'ASSESSMENT_CANCELLED' });
      return;
    }

    const values = parsed.data;
    await prisma.classStatistic.upsert({
      where: { assessmentId: existing.id },
      create: {
        assessmentId: existing.id,
        mean: values.mean,
        median: values.median ?? null,
        standardDeviation: values.standardDeviation ?? null,
        minimum: values.minimum ?? null,
        maximum: values.maximum ?? null,
        sourceType: 'USER_ENTERED',
        recordedAt: new Date(),
      },
      update: {
        mean: values.mean,
        median: values.median ?? null,
        standardDeviation: values.standardDeviation ?? null,
        minimum: values.minimum ?? null,
        maximum: values.maximum ?? null,
        sourceType: 'USER_ENTERED',
        recordedAt: new Date(),
      },
    });
    const assessment = await loadOwnedAssessment(existing.id, userId);
    if (!assessment) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    response.status(200).json({ assessment: serializeAssessment(assessment, userId) });
  });

  app.delete('/api/assessments/:assessmentId/class-statistics', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const existing = await loadOwnedAssessment(request.params.assessmentId, userId);
    if (!existing) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    await prisma.classStatistic.deleteMany({ where: { assessmentId: existing.id } });
    const assessment = await loadOwnedAssessment(existing.id, userId);
    if (!assessment) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    response.status(200).json({ assessment: serializeAssessment(assessment, userId) });
  });
  app.put('/api/assessments/:assessmentId/score', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const parsed = scoreSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const existing = await loadOwnedAssessment(request.params.assessmentId, userId);
    if (!existing) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    if (existing.status === 'CANCELLED') {
      response.status(409).json({ error: 'ASSESSMENT_CANCELLED' });
      return;
    }

    const values = parsed.data;
    const hasPoints = values.pointsEarned !== null && values.pointsEarned !== undefined;
    const pointsEarned = hasPoints ? (values.pointsEarned as number) : null;
    const percentage = hasPoints ? null : (values.percentage as number);
    const pointsPossible = decimalOrNull(existing.pointsPossible);
    if (pointsEarned !== null && (pointsPossible === null || pointsEarned > pointsPossible)) {
      validationError(response, {
        pointsEarned: ['Points earned cannot exceed the assessment points possible.'],
      });
      return;
    }

    await prisma.$transaction([
      prisma.assessmentScore.upsert({
        where: {
          assessmentId_userId: {
            assessmentId: existing.id,
            userId,
          },
        },
        create: {
          assessmentId: existing.id,
          userId,
          pointsEarned,
          percentageOverride: percentage,
          sourceType: 'USER_ENTERED',
          recordedAt: new Date(),
        },
        update: {
          pointsEarned,
          percentageOverride: percentage,
          sourceType: 'USER_ENTERED',
          recordedAt: new Date(),
        },
      }),
      prisma.assessment.update({
        where: { id: existing.id },
        data: { status: 'GRADED' },
      }),
    ]);

    const assessment = await loadOwnedAssessment(existing.id, userId);
    if (!assessment) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    response.status(200).json({ assessment: serializeAssessment(assessment, userId) });
  });

  app.delete('/api/assessments/:assessmentId/score', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const existing = await loadOwnedAssessment(request.params.assessmentId, userId);
    if (!existing) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.assessmentScore.deleteMany({
        where: { assessmentId: existing.id, userId },
      });
      if (existing.status === 'GRADED') {
        await transaction.assessment.update({
          where: { id: existing.id },
          data: { status: 'UPCOMING' },
        });
      }
    });

    const assessment = await loadOwnedAssessment(existing.id, userId);
    if (!assessment) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    response.status(200).json({ assessment: serializeAssessment(assessment, userId) });
  });
  app.delete('/api/assessments/:assessmentId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;
    const existing = await loadOwnedAssessment(request.params.assessmentId, userId);
    if (!existing) {
      response.status(404).json({ error: 'ASSESSMENT_NOT_FOUND' });
      return;
    }
    if (existing.status === 'CANCELLED') {
      response.status(200).json({ assessment: serializeAssessment(existing, userId) });
      return;
    }
    const assessment = await prisma.assessment.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED' },
      include: assessmentInclude,
    });
    response
      .status(200)
      .json({ assessment: serializeAssessment(assessment as AssessmentRecord, userId) });
  });
}
