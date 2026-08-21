import { describe, expect, it } from 'vitest';
import { calculateGrade, calculateGradeScenario } from './index.js';

describe('grade engine level 1', () => {
  it('calculates weighted points, graded weight, remaining weight, and current performance', () => {
    const result = calculateGrade({
      assessments: [
        {
          id: 'assignment-1',
          title: 'Assignment 1',
          weightPercentage: 10,
          pointsPossible: 20,
          status: 'GRADED',
          score: { pointsEarned: 18 },
        },
        {
          id: 'midterm',
          title: 'Midterm',
          weightPercentage: 25,
          status: 'GRADED',
          score: { percentage: 80 },
        },
        { id: 'final', title: 'Final', weightPercentage: 65, status: 'UPCOMING' },
      ],
    });

    expect(result.weightedPointsEarned).toBe(29);
    expect(result.gradedWeight).toBe(35);
    expect(result.remainingWeight).toBe(65);
    expect(result.currentPerformance).toBeCloseTo(82.86, 2);
  });

  it('aggregates a category provisionally as only its graded portion', () => {
    const result = calculateGrade({
      categories: [
        { id: 'quizzes', name: 'Quizzes', weightPercentage: 20, aggregationRule: 'EQUAL_MEAN' },
        { id: 'final', name: 'Final', weightPercentage: 80 },
      ],
      assessments: [
        {
          id: 'quiz-1',
          title: 'Quiz 1',
          categoryId: 'quizzes',
          status: 'GRADED',
          score: { percentage: 90 },
        },
        { id: 'quiz-2', title: 'Quiz 2', categoryId: 'quizzes', status: 'UPCOMING' },
        {
          id: 'final-exam',
          title: 'Final Exam',
          categoryId: 'final',
          status: 'GRADED',
          score: { percentage: 80 },
        },
      ],
    });

    expect(result.categories).toEqual([
      expect.objectContaining({
        categoryId: 'quizzes',
        percentage: 90,
        gradedWeight: 10,
        weightedPointsEarned: 9,
      }),
      expect.objectContaining({
        categoryId: 'final',
        percentage: 80,
        gradedWeight: 80,
        weightedPointsEarned: 64,
      }),
    ]);
    expect(result.weightedPointsEarned).toBe(73);
    expect(result.gradedWeight).toBe(90);
    expect(result.currentPerformance).toBeCloseTo(81.11, 2);
  });

  it('does not treat ungraded, excused, or missing scores as zero', () => {
    const result = calculateGrade({
      assessments: [
        { id: 'upcoming', title: 'Upcoming', weightPercentage: 20, status: 'UPCOMING' },
        { id: 'excused', title: 'Excused', weightPercentage: 10, status: 'EXCUSED' },
        { id: 'missing', title: 'Missing', weightPercentage: 15, status: 'MISSING' },
      ],
    });

    expect(result.weightedPointsEarned).toBe(0);
    expect(result.gradedWeight).toBe(0);
    expect(result.currentPerformance).toBeNull();
    expect(result.assessments.map((assessment) => assessment.reason)).toEqual([
      'UNGRADED',
      'EXCUSED',
      'MISSING_SCORE',
    ]);
    expect(result.warnings).toContain(
      'A missing assessment has no explicit score and was not treated as zero.',
    );
  });

  it('supports points-weighted category aggregation', () => {
    const result = calculateGrade({
      categories: [
        {
          id: 'assignments',
          name: 'Assignments',
          weightPercentage: 30,
          aggregationRule: 'POINTS_WEIGHTED_MEAN',
        },
      ],
      assessments: [
        {
          id: 'a1',
          title: 'Assignment 1',
          categoryId: 'assignments',
          pointsPossible: 50,
          status: 'GRADED',
          score: { pointsEarned: 40 },
        },
        {
          id: 'a2',
          title: 'Assignment 2',
          categoryId: 'assignments',
          pointsPossible: 100,
          status: 'GRADED',
          score: { pointsEarned: 90 },
        },
      ],
    });

    expect(result.categories[0]).toMatchObject({
      percentage: 86.67,
      gradedWeight: 30,
      weightedPointsEarned: 26,
    });
  });

  it('keeps explicit assessment weights inside their category envelope', () => {
    const result = calculateGrade({
      categories: [
        {
          id: 'project',
          name: 'Project',
          weightPercentage: 35,
          aggregationRule: 'EXPLICIT_ASSESSMENT_WEIGHTS',
        },
      ],
      assessments: [
        {
          id: 'proposal',
          title: 'Proposal',
          categoryId: 'project',
          weightPercentage: 5,
          status: 'GRADED',
          score: { percentage: 90 },
        },
        {
          id: 'final-project',
          title: 'Final Project',
          categoryId: 'project',
          weightPercentage: 30,
          status: 'UPCOMING',
        },
      ],
    });

    expect(result.weightedPointsEarned).toBe(4.5);
    expect(result.gradedWeight).toBe(5);
    expect(result.categories[0]).toMatchObject({
      percentage: 90,
      weightedPointsEarned: 4.5,
      gradedWeight: 5,
      remainingWeight: 30,
    });
  });

  it('allows a points score to use points possible from the score entry', () => {
    expect(
      calculateGrade({
        assessments: [
          {
            id: 'assignment',
            title: 'Assignment',
            weightPercentage: 10,
            status: 'GRADED',
            score: { pointsEarned: 8, pointsPossible: 10 },
          },
        ],
      }).currentPerformance,
    ).toBe(80);
  });

  it('resolves the current absolute letter grade from known thresholds', () => {
    const result = calculateGrade({
      gradingMode: 'ABSOLUTE',
      thresholds: [
        { letterGrade: 'A', minimumPercentage: 90 },
        { letterGrade: 'A-', minimumPercentage: 85 },
        { letterGrade: 'B+', minimumPercentage: 80 },
      ],
      assessments: [
        {
          id: 'midterm',
          title: 'Midterm',
          weightPercentage: 25,
          status: 'GRADED',
          score: { percentage: 85 },
        },
      ],
    });

    expect(result.currentPerformance).toBe(85);
    expect(result.currentGrade).toBe('A-');
  });

  it('does not infer a letter grade for relative grading or ungraded work', () => {
    const relative = calculateGrade({
      gradingMode: 'RELATIVE',
      thresholds: [{ letterGrade: 'A', minimumPercentage: 90 }],
      assessments: [
        {
          id: 'midterm',
          title: 'Midterm',
          weightPercentage: 25,
          status: 'GRADED',
          score: { percentage: 95 },
        },
      ],
    });
    const ungraded = calculateGrade({
      gradingMode: 'ABSOLUTE',
      thresholds: [{ letterGrade: 'A', minimumPercentage: 90 }],
      assessments: [{ id: 'midterm', title: 'Midterm', weightPercentage: 25 }],
    });

    expect(relative.currentGrade).toBeNull();
    expect(relative.targetAnalyses).toEqual([]);
    expect(ungraded.currentGrade).toBeNull();
  });

  it('respects exclusive threshold boundaries and rejects duplicate thresholds', () => {
    const result = calculateGrade({
      gradingMode: 'ABSOLUTE',
      thresholds: [
        { letterGrade: 'A', minimumPercentage: 90, inclusive: false },
        { letterGrade: 'B+', minimumPercentage: 80 },
      ],
      assessments: [
        {
          id: 'midterm',
          title: 'Midterm',
          weightPercentage: 25,
          status: 'GRADED',
          score: { percentage: 90 },
        },
      ],
    });

    expect(result.currentGrade).toBe('B+');
    expect(result.targetAnalyses.find((target) => target.target === 'A')).toMatchObject({
      secured: false,
      reachable: true,
    });
    expect(() =>
      calculateGrade({
        gradingMode: 'ABSOLUTE',
        thresholds: [
          { letterGrade: 'A', minimumPercentage: 90 },
          { letterGrade: 'A', minimumPercentage: 85 },
        ],
        assessments: [],
      }),
    ).toThrow('Duplicate grade threshold');
  });

  it('calculates reachable and impossible target requirements', () => {
    const result = calculateGrade({
      gradingMode: 'ABSOLUTE',
      thresholds: [
        { letterGrade: 'A', minimumPercentage: 90 },
        { letterGrade: 'A-', minimumPercentage: 85 },
        { letterGrade: 'B+', minimumPercentage: 80 },
        { letterGrade: 'A+', minimumPercentage: 100 },
      ],
      assessments: [
        {
          id: 'graded',
          title: 'Graded work',
          weightPercentage: 40,
          status: 'GRADED',
          score: { percentage: 81.25 },
        },
        { id: 'remaining', title: 'Remaining work', weightPercentage: 60 },
      ],
    });

    expect(result.targetAnalyses).toEqual([
      {
        target: 'A+',
        threshold: 100,
        requiredRemainingAverage: 112.5,
        reachable: false,
        secured: false,
      },
      {
        target: 'A',
        threshold: 90,
        requiredRemainingAverage: 95.83,
        reachable: true,
        secured: false,
      },
      {
        target: 'A-',
        threshold: 85,
        requiredRemainingAverage: 87.5,
        reachable: true,
        secured: false,
      },
      {
        target: 'B+',
        threshold: 80,
        requiredRemainingAverage: 79.17,
        reachable: true,
        secured: false,
      },
    ]);
  });

  it('marks a target already secured when earned weighted points meet its threshold', () => {
    const result = calculateGrade({
      gradingMode: 'ABSOLUTE',
      thresholds: [{ letterGrade: 'B+', minimumPercentage: 80 }],
      assessments: [
        {
          id: 'finalized',
          title: 'Finalized work',
          weightPercentage: 100,
          status: 'GRADED',
          score: { percentage: 82 },
        },
      ],
    });

    expect(result.targetAnalyses).toEqual([
      {
        target: 'B+',
        threshold: 80,
        requiredRemainingAverage: 0,
        reachable: true,
        secured: true,
      },
    ]);
  });

  it('projects hypothetical assessment results without mutating real inputs', () => {
    const input = {
      gradingMode: 'ABSOLUTE' as const,
      thresholds: [
        { letterGrade: 'A', minimumPercentage: 90 },
        { letterGrade: 'A-', minimumPercentage: 85 },
        { letterGrade: 'B+', minimumPercentage: 80 },
      ],
      assessments: [
        {
          id: 'midterm',
          title: 'Midterm',
          weightPercentage: 40,
          status: 'GRADED' as const,
          score: { percentage: 80 },
        },
        {
          id: 'final',
          title: 'Final',
          weightPercentage: 60,
          status: 'UPCOMING' as const,
        },
      ],
    };

    const result = calculateGradeScenario(input, [{ assessmentId: 'final', percentage: 90 }]);

    expect(result.currentPerformance).toBe(86);
    expect(result.currentGrade).toBe('A-');
    expect(result.gradedWeight).toBe(100);
    expect(input.assessments[1].status).toBe('UPCOMING');
    expect(input.assessments[1].score).toBeUndefined();
  });

  it('rejects invalid or duplicate hypothetical assessment overrides', () => {
    const input = {
      assessments: [{ id: 'final', title: 'Final', weightPercentage: 100 }],
    };

    expect(() =>
      calculateGradeScenario(input, [{ assessmentId: 'unknown', percentage: 80 }]),
    ).toThrow('unknown assessment');
    expect(() =>
      calculateGradeScenario(input, [
        { assessmentId: 'final', percentage: 80 },
        { assessmentId: 'final', percentage: 90 },
      ]),
    ).toThrow('duplicate assessment');
    expect(() =>
      calculateGradeScenario(input, [{ assessmentId: 'final', percentage: 101 }]),
    ).toThrow('between 0 and 100');
  });
});
