import express from 'express';
import {
  analyzeWorkload,
  DEFAULT_WORKLOAD_ENGINE_CONFIG,
  type AssessmentType,
  type DailyPressure,
  type PressureFinding,
  type WeeklyPressure,
  type WorkloadAssessment,
  type WorkloadCommitment,
} from '@semora/workload-engine';
import { z } from 'zod';
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
const asOfSchema = z.string().datetime({ offset: true });
const dayIndexes: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function validationError(response: express.Response, details: unknown) {
  response.status(400).json({ error: 'VALIDATION_ERROR', details });
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dateAtTime(date: Date, time: Date) {
  const [hours, minutes, seconds] = time.toISOString().slice(11, 19).split(':').map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, seconds),
  );
}

function durationHours(startAt: Date, endAt: Date) {
  return (endAt.getTime() - startAt.getTime()) / (60 * 60 * 1000);
}

type CommitmentWithDetails = {
  id: string;
  name: string;
  weeklyEffortHours: { toString(): string };
  flexibility: string;
  priority: { toString(): string };
  meetings: Array<{ dayOfWeek: string; startTime: Date; endTime: Date }>;
  events: Array<{
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    estimatedEffortHours: { toString(): string } | null;
    flexibilityOverride: string | null;
  }>;
};

function expandCommitments(
  commitments: CommitmentWithDetails[],
  semesterStartAt: Date,
  semesterEndAt: Date,
): WorkloadCommitment[] {
  const occurrences: WorkloadCommitment[] = [];
  for (const commitment of commitments) {
    const weeklyEffortHours = Number(commitment.weeklyEffortHours);
    const priority = Number(commitment.priority);
    const meetingCount = Math.max(1, commitment.meetings.length);

    for (const event of commitment.events) {
      occurrences.push({
        id: event.id,
        name: `${commitment.name} · ${event.title}`,
        startAt: event.startAt,
        endAt: event.endAt,
        estimatedEffortHours:
          event.estimatedEffortHours === null ? null : Number(event.estimatedEffortHours),
        flexibility: (event.flexibilityOverride ?? commitment.flexibility) as
          'HARD' | 'SOFT' | 'FLEXIBLE',
        priority,
      });
    }

    for (const [meetingIndex, meeting] of commitment.meetings.entries()) {
      const targetDay = dayIndexes[meeting.dayOfWeek];
      if (targetDay === undefined) continue;
      for (
        let date = dayStart(semesterStartAt);
        date.getTime() <= dayStart(semesterEndAt).getTime();
        date = new Date(date.getTime() + millisecondsPerDay)
      ) {
        if (date.getUTCDay() !== targetDay) continue;
        const startAt = dateAtTime(date, meeting.startTime);
        const endAt = dateAtTime(date, meeting.endTime);
        occurrences.push({
          id: `${commitment.id}:${dateOnly(date)}:${meetingIndex}`,
          name: commitment.name,
          startAt,
          endAt,
          estimatedEffortHours: durationHours(startAt, endAt) + weeklyEffortHours / meetingCount,
          flexibility: commitment.flexibility as 'HARD' | 'SOFT' | 'FLEXIBLE',
          priority,
        });
      }
    }
  }
  return occurrences;
}

function effortSource(
  personalEffortHours: number | null,
  outlineEffortHours: number | null,
  assessmentType: AssessmentType,
) {
  if (personalEffortHours !== null) return 'PERSONAL_ESTIMATE' as const;
  if (outlineEffortHours !== null) return 'OUTLINE_ESTIMATE' as const;
  if (DEFAULT_WORKLOAD_ENGINE_CONFIG.effortDefaults[assessmentType] !== null) {
    return 'GENERIC_DEFAULT' as const;
  }
  return 'UNKNOWN' as const;
}

function serializeDailyPressure(day: DailyPressure) {
  return {
    date: day.date,
    pressure: day.pressure,
    band: day.band,
    estimatedDemandHours: day.estimatedDemandHours,
    drivers: day.drivers,
  };
}

type WorkloadDriverDetails = {
  id: string;
  kind: 'ASSESSMENT' | 'COMMITMENT' | 'UNKNOWN';
  label: string;
  courseCode: string | null;
};

function serializeWeeklyPressure(
  week: WeeklyPressure,
  driverDetails: ReadonlyMap<string, WorkloadDriverDetails>,
) {
  return {
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    pressure: week.pressure,
    band: week.band,
    estimatedDemandHours: week.estimatedDemandHours,
    majorAssessmentCount: week.majorAssessmentCount,
    uniqueCourseCount: week.uniqueCourseCount,
    drivers: week.drivers,
    driverDetails: week.drivers.map(
      (id) =>
        driverDetails.get(id) ?? {
          id,
          kind: 'UNKNOWN' as const,
          label: 'Unknown demand',
          courseCode: null,
        },
    ),
  };
}

function serializePressureFinding(finding: PressureFinding) {
  return {
    type: finding.type,
    severity: finding.severity,
    messageKey: finding.messageKey,
    windowStart: finding.windowStart,
    windowEnd: finding.windowEnd,
    pressure: finding.pressure,
    assessmentIds: finding.assessmentIds,
    commitmentIds: finding.commitmentIds,
  };
}

export function registerWorkloadRoutes(app: express.Express) {
  app.get('/api/workspaces/:workspaceId/workload', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const asOfInput =
      typeof request.query.asOf === 'string' ? request.query.asOf : new Date().toISOString();
    const parsedAsOf = asOfSchema.safeParse(asOfInput);
    if (!parsedAsOf.success) {
      validationError(response, { asOf: parsedAsOf.error.flatten() });
      return;
    }
    const workspace = await prisma.semesterWorkspace.findFirst({
      where: { id: request.params.workspaceId, userId, state: 'ACTIVE' },
      select: {
        id: true,
        academicTerm: { select: { startDate: true, endDate: true } },
        commitments: {
          include: {
            meetings: true,
            events: { orderBy: { startAt: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }
    const currentAt = new Date(parsedAsOf.data);

    const assessments = await prisma.assessment.findMany({
      where: {
        activeCourseState: {
          activeCourseSelection: { workspaceId: workspace.id, status: 'ACTIVE' },
        },
      },
      include: {
        activeCourseState: {
          include: {
            activeCourseSelection: {
              include: {
                section: { include: { courseOffering: { include: { course: true } } } },
              },
            },
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    });

    const workloadAssessments: WorkloadAssessment[] = assessments.map((assessment) => {
      const courseOffering =
        assessment.activeCourseState.activeCourseSelection.section.courseOffering;
      const assessmentType = assessment.assessmentType as AssessmentType;
      const personalEffortHours =
        assessment.personalEffortHours === null ? null : Number(assessment.personalEffortHours);
      const outlineEffortHours =
        assessment.estimatedEffortHours === null ? null : Number(assessment.estimatedEffortHours);
      return {
        id: assessment.id,
        courseId: courseOffering.id,
        title: assessment.title,
        type: assessmentType,
        dueAt: assessment.dueAt,
        datePrecision: assessment.datePrecision as NonNullable<WorkloadAssessment['datePrecision']>,
        weightPercentage: assessment.weightPercentage ? Number(assessment.weightPercentage) : null,
        estimatedEffortHours: personalEffortHours ?? outlineEffortHours,
        effortConfidence:
          personalEffortHours !== null
            ? assessment.personalEffortConfidence !== null
              ? Number(assessment.personalEffortConfidence)
              : DEFAULT_WORKLOAD_ENGINE_CONFIG.explicitEffortConfidence
            : assessment.effortConfidence !== null
              ? Number(assessment.effortConfidence)
              : null,
        completionStatus: assessment.workStatus as NonNullable<
          WorkloadAssessment['completionStatus']
        >,
        status: assessment.status as NonNullable<WorkloadAssessment['status']>,
        progressPercentage:
          assessment.progressPercentage === null ? null : Number(assessment.progressPercentage),
      };
    });
    const workloadCommitments = expandCommitments(
      workspace.commitments,
      workspace.academicTerm.startDate,
      workspace.academicTerm.endDate,
    );
    const driverDetails = new Map<string, WorkloadDriverDetails>();
    for (const assessment of assessments) {
      const courseOffering =
        assessment.activeCourseState.activeCourseSelection.section.courseOffering;
      driverDetails.set(assessment.id, {
        id: assessment.id,
        kind: 'ASSESSMENT',
        label: assessment.title,
        courseCode: courseOffering.course.courseCode,
      });
    }
    for (const commitment of workloadCommitments) {
      driverDetails.set(commitment.id, {
        id: commitment.id,
        kind: 'COMMITMENT',
        label: commitment.name,
        courseCode: null,
      });
    }
    const analysis = analyzeWorkload({
      currentAt,
      semesterStartAt: workspace.academicTerm.startDate,
      semesterEndAt: workspace.academicTerm.endDate,
      assessments: workloadAssessments,
      commitments: workloadCommitments,
    });
    const dailyPressure = analysis.dailyPressure.map(serializeDailyPressure);
    const currentDayPressure = analysis.currentDayPressure
      ? serializeDailyPressure(analysis.currentDayPressure)
      : null;
    const weeklyPressure = analysis.weeklyPressure.map((week) =>
      serializeWeeklyPressure(week, driverDetails),
    );
    const currentWeekPressure = analysis.currentWeekPressure
      ? serializeWeeklyPressure(analysis.currentWeekPressure, driverDetails)
      : null;
    const pressureByCommitmentId = new Map<string, number>();
    for (const day of analysis.dailyPressure) {
      for (const contribution of day.contributions) {
        if (contribution.kind !== 'COMMITMENT') continue;
        pressureByCommitmentId.set(
          contribution.id,
          (pressureByCommitmentId.get(contribution.id) ?? 0) + contribution.contribution,
        );
      }
    }
    const assessmentById = new Map(assessments.map((assessment) => [assessment.id, assessment]));
    const upcomingAssessments = analysis.upcomingAssessments.map((item) => {
      const assessment = assessmentById.get(item.id);
      const courseOffering =
        assessment?.activeCourseState.activeCourseSelection.section.courseOffering;
      const personalEffortHours =
        assessment?.personalEffortHours === null || assessment?.personalEffortHours === undefined
          ? null
          : Number(assessment.personalEffortHours);
      const outlineEffortHours =
        assessment?.estimatedEffortHours === null || assessment?.estimatedEffortHours === undefined
          ? null
          : Number(assessment.estimatedEffortHours);
      const type = (assessment?.assessmentType ?? item.type) as AssessmentType;
      return {
        ...item,
        courseCode: courseOffering?.course.courseCode ?? null,
        courseTitle: courseOffering?.course.title ?? null,
        estimatedEffortHours:
          personalEffortHours ??
          outlineEffortHours ??
          DEFAULT_WORKLOAD_ENGINE_CONFIG.effortDefaults[type],
        effortSource: effortSource(personalEffortHours, outlineEffortHours, type),
      };
    });
    response.status(200).json({
      workload: {
        engineVersion: analysis.engineVersion,
        asOf: currentAt.toISOString(),
        confidence: analysis.confidence,
        completeness: analysis.completeness,
        currentDayPressure,
        dailyPressure,
        currentWeekPressure,
        weeklyPressure,
        findings: analysis.findings.map(serializePressureFinding),
        assessments: upcomingAssessments,
        summary: {
          assessmentCount: workloadAssessments.length,
          datedAssessmentCount: workloadAssessments.filter((assessment) => assessment.dueAt).length,
          unknownDateCount: workloadAssessments.filter((assessment) => !assessment.dueAt).length,
          remainingEffortHours: Number(
            upcomingAssessments
              .reduce((sum, assessment) => sum + (assessment.remainingEffortHours ?? 0), 0)
              .toFixed(2),
          ),
          overlappingAssessmentCount: upcomingAssessments.filter(
            (assessment) => assessment.overlapCount > 0,
          ).length,
          commitmentOccurrenceCount: workloadCommitments.length,
          commitmentPressure: Number(
            [...pressureByCommitmentId.values()]
              .reduce((sum, contribution) => sum + contribution, 0)
              .toFixed(2),
          ),
        },
      },
    });
  });
}
