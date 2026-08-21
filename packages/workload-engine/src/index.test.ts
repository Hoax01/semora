import { describe, expect, it } from 'vitest';
import {
  analyzeWorkload,
  calculateImportance,
  DEFAULT_WORKLOAD_ENGINE_CONFIG,
  type WorkloadAssessment,
} from './index.js';

const baseInput = {
  currentAt: '2026-09-01T09:00:00Z',
  semesterStartAt: '2026-09-01T00:00:00Z',
  semesterEndAt: '2026-09-30T00:00:00Z',
};

function assessment(overrides: Partial<WorkloadAssessment> = {}): WorkloadAssessment {
  return {
    id: 'assessment-1',
    courseId: 'course-1',
    title: 'Assignment 1',
    type: 'ASSIGNMENT',
    dueAt: '2026-09-07T23:59:00Z',
    weightPercentage: 10,
    estimatedEffortHours: 8,
    ...overrides,
  };
}

describe('workload engine', () => {
  it('uses explicit effort and type defaults with distinct provenance', () => {
    const result = analyzeWorkload({
      ...baseInput,
      assessments: [
        assessment(),
        assessment({ id: 'quiz-1', type: 'QUIZ', title: 'Quiz 1', estimatedEffortHours: null }),
      ],
    });

    expect(result.upcomingAssessments.find((item) => item.id === 'assessment-1')).toMatchObject({
      remainingEffortHours: 8,
      effortSource: 'EXPLICIT',
    });
    expect(result.upcomingAssessments.find((item) => item.id === 'quiz-1')).toMatchObject({
      remainingEffortHours: DEFAULT_WORKLOAD_ENGINE_CONFIG.effortDefaults.QUIZ,
      effortSource: 'GENERIC_DEFAULT',
      effortConfidence: DEFAULT_WORKLOAD_ENGINE_CONFIG.defaultEffortConfidence,
    });
  });

  it('increases urgency as a deadline approaches', () => {
    const far = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ dueAt: '2026-09-14' })],
    });
    const near = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ dueAt: '2026-09-04' })],
    });

    expect(near.upcomingAssessments[0]?.taskPressure).toBeGreaterThan(
      far.upcomingAssessments[0]?.taskPressure ?? 0,
    );
    expect(near.upcomingAssessments[0]?.urgency).toBeGreaterThan(
      far.upcomingAssessments[0]?.urgency ?? 0,
    );
  });

  it('reduces pressure when a deadline is extended', () => {
    const before = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ dueAt: '2026-09-04' })],
    });
    const after = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ dueAt: '2026-09-12' })],
    });

    expect(before.currentDayPressure?.pressure ?? 0).toBeGreaterThan(
      after.currentDayPressure?.pressure ?? 0,
    );
  });

  it('removes future assessment pressure after completion', () => {
    const upcoming = analyzeWorkload({ ...baseInput, assessments: [assessment()] });
    const done = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ completionStatus: 'DONE' })],
    });

    expect(upcoming.dailyPressure.some((day) => day.pressure > 0)).toBe(true);
    expect(done.dailyPressure.every((day) => day.pressure === 0)).toBe(true);
    expect(done.upcomingAssessments).toHaveLength(0);
  });

  it('distributes assessment demand across the preparation horizon', () => {
    const result = analyzeWorkload({ ...baseInput, assessments: [assessment()] });
    const preparationDay = result.dailyPressure.find((day) => day.date === '2026-09-02');
    const dueDay = result.dailyPressure.find((day) => day.date === '2026-09-07');

    expect(preparationDay).toMatchObject({
      estimatedDemandHours: expect.any(Number),
      drivers: ['assessment-1'],
    });
    expect(dueDay).toMatchObject({
      estimatedDemandHours: expect.any(Number),
      drivers: ['assessment-1'],
    });
    expect(preparationDay?.pressure).toBeGreaterThan(0);
    expect(dueDay?.pressure).toBeGreaterThan(0);
  });

  it('raises pressure when preparation windows overlap', () => {
    const single = analyzeWorkload({ ...baseInput, assessments: [assessment()] });
    const overlapping = analyzeWorkload({
      ...baseInput,
      assessments: [
        assessment(),
        assessment({ id: 'assessment-2', courseId: 'course-2', title: 'Midterm', type: 'MIDTERM' }),
      ],
    });

    expect(overlapping.currentWeekPressure?.pressure ?? 0).toBeGreaterThan(
      single.currentWeekPressure?.pressure ?? 0,
    );
    expect(overlapping.findings.some((finding) => finding.type === 'ASSESSMENT_CLUSTER')).toBe(
      true,
    );
    expect(overlapping.upcomingAssessments.every((item) => item.overlapCount === 1)).toBe(true);
  });

  it('exposes preparation and deadline-compression factors', () => {
    const result = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ estimatedEffortHours: 12, dueAt: '2026-09-03' })],
    });

    expect(result.upcomingAssessments[0]).toMatchObject({
      preparationDays: DEFAULT_WORKLOAD_ENGINE_CONFIG.preparationDays.ASSIGNMENT,
      importance: expect.any(Number),
      urgency: expect.any(Number),
      deadlineCompression: expect.any(Number),
    });
  });

  it('adds dated commitment demand and a collision finding', () => {
    const withoutCommitment = analyzeWorkload({ ...baseInput, assessments: [assessment()] });
    const withCommitment = analyzeWorkload({
      ...baseInput,
      assessments: [assessment()],
      commitments: [
        {
          id: 'ta-grading',
          name: 'TA grading',
          startAt: '2026-09-03T12:00:00Z',
          endAt: '2026-09-03T15:00:00Z',
          estimatedEffortHours: 3,
          flexibility: 'HARD',
        },
      ],
    });

    expect(withCommitment.currentWeekPressure?.pressure ?? 0).toBeGreaterThan(
      withoutCommitment.currentWeekPressure?.pressure ?? 0,
    );
    expect(withCommitment.findings.some((finding) => finding.type === 'COMMITMENT_COLLISION')).toBe(
      true,
    );
  });

  it('does not invent pressure peaks for unknown dates', () => {
    const result = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ dueAt: null, datePrecision: 'UNKNOWN' })],
    });

    expect(result.weeklyPressure.every((week) => week.pressure === 0)).toBe(true);
    expect(result.peakPeriods).toHaveLength(0);
    expect(result.findings.map((finding) => finding.type)).toContain(
      'UNKNOWN_DATES_REDUCE_CONFIDENCE',
    );
    expect(result.completeness).toBe(0);
  });

  it('keeps active overdue work visible and pressures the current day', () => {
    const result = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ dueAt: '2026-08-30', status: 'MISSING' })],
    });

    expect(result.upcomingAssessments[0]?.id).toBe('assessment-1');
    expect(result.currentDayPressure?.pressure ?? 0).toBeGreaterThan(0);
    expect(result.findings.some((finding) => finding.type === 'DEADLINE_COMPRESSION')).toBe(true);
  });

  it('keeps importance separate from effort', () => {
    expect(calculateImportance(25)).toBeGreaterThan(calculateImportance(5) ?? 0);
    const lowWeightHighEffort = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ weightPercentage: 2, estimatedEffortHours: 20 })],
    });
    const highWeightLowEffort = analyzeWorkload({
      ...baseInput,
      assessments: [assessment({ weightPercentage: 40, estimatedEffortHours: 1 })],
    });

    expect(lowWeightHighEffort.upcomingAssessments[0]?.remainingEffortHours).toBe(20);
    expect(highWeightLowEffort.upcomingAssessments[0]?.importance).toBeGreaterThan(
      lowWeightHighEffort.upcomingAssessments[0]?.importance ?? 0,
    );
  });
});
