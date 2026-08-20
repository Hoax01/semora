import { describe, expect, it } from 'vitest';
import {
  analyzeCandidateSchedule,
  calculateCoursePreferenceFit,
  calculateScheduleMetrics,
  calculateTotalCredits,
  calculateWorkloadInteractionPenalties,
  detectTimetableClashes,
  estimateStructuralWorkloadProfile,
  resolveWorkloadProfile,
  validateWorkloadProfile,
  type CandidateCourseInput,
  type CourseWorkloadProfile,
  type TimetableCourse,
} from './index.js';

const course = (overrides: Partial<TimetableCourse>): TimetableCourse => ({
  id: overrides.id ?? 'selection-1',
  courseOfferingId: overrides.courseOfferingId ?? overrides.id ?? 'offering-1',
  courseCode: overrides.courseCode ?? 'CS 101',
  sectionCode: overrides.sectionCode ?? '1',
  meetings: overrides.meetings ?? [{ dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '11:00' }],
});

describe('detectTimetableClashes', () => {
  it('detects overlapping course meetings and returns the overlap interval', () => {
    const result = detectTimetableClashes({
      courses: [
        course({ id: 'selection-1' }),
        course({
          id: 'selection-2',
          courseOfferingId: 'offering-2',
          courseCode: 'CS 102',
          meetings: [{ dayOfWeek: 'MONDAY', startTime: '10:30', endTime: '11:30' }],
        }),
      ],
    });

    expect(result).toEqual({
      valid: false,
      clashes: [
        expect.objectContaining({
          type: 'COURSE_COURSE',
          dayOfWeek: 'MONDAY',
          startTime: '10:30',
          endTime: '11:00',
        }),
      ],
    });
  });

  it('allows back-to-back and different-day meetings', () => {
    const result = detectTimetableClashes({
      courses: [
        course({ id: 'selection-1' }),
        course({
          id: 'selection-2',
          courseOfferingId: 'offering-2',
          meetings: [{ dayOfWeek: 'MONDAY', startTime: '11:00', endTime: '12:00' }],
        }),
        course({
          id: 'selection-3',
          courseOfferingId: 'offering-3',
          meetings: [{ dayOfWeek: 'TUESDAY', startTime: '10:00', endTime: '11:00' }],
        }),
      ],
    });

    expect(result).toEqual({ valid: true, clashes: [] });
  });

  it('only treats hard commitments as invalidating clashes', () => {
    const result = detectTimetableClashes({
      courses: [course({})],
      commitments: [
        {
          id: 'soft-1',
          name: 'Gym',
          flexibility: 'FLEXIBLE',
          meetings: [{ dayOfWeek: 'MONDAY', startTime: '10:15', endTime: '10:45' }],
        },
        {
          id: 'soft-2',
          name: 'Society',
          flexibility: 'SOFT',
          meetings: [{ dayOfWeek: 'MONDAY', startTime: '10:15', endTime: '10:45' }],
        },
        {
          id: 'hard-1',
          name: 'TAship',
          flexibility: 'HARD',
          meetings: [{ dayOfWeek: 'MONDAY', startTime: '10:15', endTime: '10:45' }],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.clashes).toHaveLength(1);
    expect(result.clashes[0]).toMatchObject({
      type: 'COURSE_HARD_COMMITMENT',
      second: { kind: 'COMMITMENT', label: 'TAship' },
    });
  });

  it('rejects a malformed isolated meeting', () => {
    expect(() =>
      detectTimetableClashes({
        courses: [
          course({
            meetings: [{ dayOfWeek: 'MONDAY', startTime: '11:00', endTime: '10:00' }],
          }),
        ],
      }),
    ).toThrow('Timetable meetings must end after they start.');
  });
});

describe('calculateTotalCredits', () => {
  it('adds decimal course credits without floating-point display drift', () => {
    expect(calculateTotalCredits([3, 3, 4, 0.5])).toBe(10.5);
    expect(calculateTotalCredits([0.1, 0.2])).toBe(0.3);
  });

  it('rejects invalid credit values', () => {
    expect(() => calculateTotalCredits([3, -1])).toThrow(
      'Course credits must be finite non-negative numbers.',
    );
    expect(() => calculateTotalCredits([Number.NaN])).toThrow(
      'Course credits must be finite non-negative numbers.',
    );
  });
});

const scheduleCourse = (overrides: Partial<CandidateCourseInput>): CandidateCourseInput => ({
  id: overrides.id ?? 'course-1',
  courseOfferingId: overrides.courseOfferingId ?? overrides.id ?? 'offering-1',
  courseCode: overrides.courseCode ?? 'CS 101',
  courseTitle: overrides.courseTitle ?? 'Foundations',
  creditHours: overrides.creditHours ?? 3,
  sectionCode: overrides.sectionCode ?? '1',
  meetings: overrides.meetings ?? [],
  workloadProfile: overrides.workloadProfile,
  interestScore: overrides.interestScore,
  careerRelevanceScore: overrides.careerRelevanceScore,
});

describe('calculateScheduleMetrics', () => {
  it('calculates class duration, campus span, gaps, and free days from merged blocks', () => {
    const result = calculateScheduleMetrics([
      scheduleCourse({
        meetings: [
          { dayOfWeek: 'MONDAY', startTime: '08:30', endTime: '10:00' },
          { dayOfWeek: 'MONDAY', startTime: '11:00', endTime: '12:00' },
          { dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '11:00' },
        ],
      }),
      scheduleCourse({
        id: 'course-2',
        courseOfferingId: 'offering-2',
        meetings: [{ dayOfWeek: 'MONDAY', startTime: '09:30', endTime: '10:30' }],
      }),
    ]);

    expect(result.days.MONDAY).toMatchObject({
      classMinutes: 180,
      campusSpanMinutes: 210,
      idleGapMinutes: 30,
      blockCount: 2,
      earliestStartTime: '08:30',
      latestEndTime: '12:00',
      earlyClassMinutes: 30,
      isLongDay: false,
    });
    expect(result.days.WEDNESDAY).toMatchObject({
      classMinutes: 60,
      campusSpanMinutes: 60,
      blockCount: 1,
    });
    expect(result.scheduledDays).toEqual(['MONDAY', 'WEDNESDAY']);
    expect(result.freeDays).toEqual(['TUESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
    expect(result.totalClassMinutes).toBe(240);
    expect(result.totalIdleGapMinutes).toBe(30);
    expect(result.longestDay).toBe('MONDAY');
  });

  it('marks long days and exposes late-class minutes using configurable thresholds', () => {
    const result = calculateScheduleMetrics(
      [
        scheduleCourse({
          meetings: [{ dayOfWeek: 'THURSDAY', startTime: '14:00', endTime: '20:00' }],
        }),
      ],
      {
        meaningfulGapMinutes: 15,
        earlyClassThresholdMinutes: 8 * 60,
        lateClassThresholdMinutes: 18 * 60,
        longDayMinutes: 5 * 60,
      },
    );

    expect(result.days.THURSDAY).toMatchObject({
      classMinutes: 360,
      lateClassMinutes: 120,
      isLongDay: true,
    });
    expect(result.longDays).toEqual(['THURSDAY']);
  });

  it('rejects malformed intervals even when the schedule has one course', () => {
    expect(() =>
      calculateScheduleMetrics([
        scheduleCourse({
          meetings: [{ dayOfWeek: 'FRIDAY', startTime: '12:00', endTime: '11:00' }],
        }),
      ]),
    ).toThrow('Timetable meetings must end after they start.');
  });
});

describe('analyzeCandidateSchedule', () => {
  it('combines hard-constraint validity with deterministic schedule metrics', () => {
    const result = analyzeCandidateSchedule({
      candidateId: 'candidate-1',
      courses: [
        scheduleCourse({
          meetings: [{ dayOfWeek: 'TUESDAY', startTime: '10:00', endTime: '11:00' }],
        }),
        scheduleCourse({
          id: 'course-2',
          courseOfferingId: 'offering-2',
          courseCode: 'CS 102',
          meetings: [{ dayOfWeek: 'TUESDAY', startTime: '10:30', endTime: '11:30' }],
        }),
      ],
      commitments: [],
    });

    expect(result).toMatchObject({
      candidateId: 'candidate-1',
      engineVersion: '0.1',
      validity: { valid: false },
      schedule: { scheduledDays: ['TUESDAY'] },
    });
    expect(result.validity.clashes).toHaveLength(1);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'TIMETABLE_CLASH', severity: 'CRITICAL' }),
      ]),
    );
  });
});

describe('course preference fit', () => {
  it('averages known ratings and reports independent completeness', () => {
    const result = calculateCoursePreferenceFit([
      {
        ...scheduleCourse({ id: 'course-1', creditHours: 1 }),
        interestScore: 1,
        careerRelevanceScore: 0.5,
      },
      {
        ...scheduleCourse({ id: 'course-2', creditHours: 2 }),
        interestScore: 0.5,
        careerRelevanceScore: null,
      },
      {
        ...scheduleCourse({ id: 'course-3', creditHours: 3 }),
        interestScore: null,
        careerRelevanceScore: 1,
      },
    ]);

    expect(result).toEqual({
      interestFit: 2 / 3,
      careerFit: 0.875,
      interestKnownCount: 2,
      careerKnownCount: 2,
      courseCount: 3,
      interestCompleteness: 2 / 3,
      careerCompleteness: 2 / 3,
    });
  });

  it('keeps an entirely unknown dimension unknown and validates normalized ratings', () => {
    expect(
      calculateCoursePreferenceFit([scheduleCourse({ interestScore: undefined })]),
    ).toMatchObject({
      interestFit: null,
      interestKnownCount: 0,
      interestCompleteness: 0,
    });
    expect(calculateCoursePreferenceFit([])).toMatchObject({
      interestFit: null,
      careerFit: null,
      courseCount: 0,
      interestCompleteness: 0,
      careerCompleteness: 0,
    });
    expect(() => calculateCoursePreferenceFit([scheduleCourse({ interestScore: 1.1 })])).toThrow(
      'Course preference scores must be finite numbers between 0 and 1.',
    );
  });

  it('includes the preference summary in candidate analysis', () => {
    const result = analyzeCandidateSchedule({
      courses: [scheduleCourse({ interestScore: 0.25, careerRelevanceScore: 1 })],
      commitments: [],
    });

    expect(result.coursePreferenceFit).toEqual({
      interestFit: 0.25,
      careerFit: 1,
      interestKnownCount: 1,
      careerKnownCount: 1,
      courseCount: 1,
      interestCompleteness: 1,
      careerCompleteness: 1,
    });
  });
});

describe('workload interaction penalties', () => {
  const profile = (overrides: Partial<CourseWorkloadProfile>): CourseWorkloadProfile => overrides;

  it('keeps one heavy course penalty-free and increases concentration penalties', () => {
    const oneProjectCourse = calculateWorkloadInteractionPenalties([
      profile({ projectIntensity: 7 }),
    ]);
    const twoProjectCourses = calculateWorkloadInteractionPenalties([
      profile({ projectIntensity: 7 }),
      profile({ projectIntensity: 8 }),
    ]);
    const threeProjectCourses = calculateWorkloadInteractionPenalties([
      profile({ projectIntensity: 7 }),
      profile({ projectIntensity: 8 }),
      profile({ projectIntensity: 9 }),
    ]);

    expect(oneProjectCourse.projectConcentration).toMatchObject({
      heavyCourseCount: 1,
      penalty: 0,
    });
    expect(twoProjectCourses.projectConcentration.penalty).toBe(0.5);
    expect(threeProjectCourses.projectConcentration.penalty).toBe(1.5);
  });

  it('calculates continuous-assessment and exam interactions independently', () => {
    const result = calculateWorkloadInteractionPenalties([
      profile({ continuousWorkload: 7, examIntensity: 7 }),
      profile({ continuousWorkload: 8, examIntensity: 8 }),
      profile({ continuousWorkload: 9, examIntensity: 9 }),
      profile({ examIntensity: 10 }),
    ]);

    expect(result).toMatchObject({
      continuousAssessmentConcentration: {
        knownCourseCount: 3,
        heavyCourseCount: 3,
        penalty: 1.5,
      },
      examConcentration: {
        knownCourseCount: 4,
        heavyCourseCount: 4,
        penalty: 3,
      },
      totalPenalty: 4.5,
    });
  });

  it('does not treat unknown workload dimensions as heavy courses', () => {
    const result = calculateWorkloadInteractionPenalties([
      profile({ projectIntensity: 8 }),
      profile({ projectIntensity: null }),
      profile({}),
    ]);

    expect(result.projectConcentration).toEqual({
      threshold: 7,
      knownCourseCount: 1,
      heavyCourseCount: 1,
      penalty: 0,
    });
  });
});

describe('candidate metrics', () => {
  it('combines known workload, schedule, commitment, and preference inputs', () => {
    const workloadProfile: CourseWorkloadProfile = {
      overallIntensity: 8,
      continuousWorkload: 8,
      projectIntensity: 8,
      examIntensity: 8,
      assessmentFragmentation: 6,
      readingIntensity: 8,
      labIntensity: 8,
      confidence: 0.8,
    };
    const result = analyzeCandidateSchedule({
      courses: [
        scheduleCourse({
          id: 'course-1',
          interestScore: 1,
          careerRelevanceScore: 0.5,
          meetings: [{ dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '11:00' }],
          workloadProfile,
        }),
        scheduleCourse({
          id: 'course-2',
          interestScore: 0.5,
          careerRelevanceScore: 0.5,
          meetings: [{ dayOfWeek: 'MONDAY', startTime: '11:00', endTime: '12:00' }],
          workloadProfile,
        }),
      ],
      commitments: [],
    });

    expect(result.metrics).toMatchObject({
      academicIntensity: 9.5,
      continuousLoad: 8.5,
      projectLoad: 8.5,
      examLoad: 8.5,
      assessmentFragmentation: 6,
      interestFit: 7.5,
      careerFit: 5,
      balance: 10,
      commitmentCompatibility: 10,
      analysisConfidence: 0.9,
    });
    expect(result.metrics.dataCompleteness).toBeGreaterThan(0.5);
    expect(result.metrics.scheduleQuality).toBeGreaterThan(0);
  });

  it('keeps unavailable candidate metrics explicit instead of inventing scores', () => {
    const result = analyzeCandidateSchedule({
      courses: [scheduleCourse({ meetings: [] })],
      commitments: [],
    });

    expect(result.metrics).toMatchObject({
      continuousLoad: null,
      projectLoad: null,
      examLoad: null,
      assessmentFragmentation: null,
      interestFit: null,
      careerFit: null,
      balance: null,
      scheduleQuality: expect.any(Number),
      dataCompleteness: expect.any(Number),
    });
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'LOW_DATA_COMPLETENESS' })]),
    );
  });
});

describe('structured candidate findings', () => {
  it('reports explainable workload and schedule patterns with stable severities', () => {
    const workloadProfile: CourseWorkloadProfile = {
      overallIntensity: 6,
      continuousWorkload: 8,
      projectIntensity: 8,
      examIntensity: 8,
      assessmentFragmentation: 6,
      readingIntensity: 5,
      labIntensity: 5,
      scheduleBurden: 5,
      confidence: 0.8,
    };
    const result = analyzeCandidateSchedule({
      courses: [
        scheduleCourse({
          id: 'course-1',
          meetings: [{ dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '09:00' }],
          workloadProfile,
        }),
        scheduleCourse({
          id: 'course-2',
          meetings: [{ dayOfWeek: 'TUESDAY', startTime: '10:00', endTime: '11:00' }],
          workloadProfile,
        }),
        scheduleCourse({
          id: 'course-3',
          meetings: [{ dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '19:00' }],
          workloadProfile,
        }),
      ],
      commitments: [
        {
          id: 'work-1',
          name: 'Work',
          flexibility: 'SOFT',
          weeklyEffortHours: 8,
          meetings: [],
        },
      ],
    });

    expect(result.findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining([
        'PROJECT_CONCENTRATION',
        'CONTINUOUS_ASSESSMENT_CONCENTRATION',
        'HIGH_EXAM_CONCENTRATION',
        'LONG_CAMPUS_DAY',
        'EARLY_CLASS_PATTERN',
        'LATE_CLASS_PATTERN',
        'HEAVY_FIXED_COMMITMENTS',
        'FREE_DAY',
      ]),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PROJECT_CONCENTRATION',
          severity: 'HIGH',
          heavyCourseCount: 3,
          messageKey: 'three_project_heavy_courses',
          relatedCourseIds: ['course-1', 'course-2', 'course-3'],
        }),
      ]),
    );
  });
});

describe('preliminary workload profiles', () => {
  it('derives only explainable structural estimates and preserves unknown dimensions', () => {
    const profile = estimateStructuralWorkloadProfile({
      creditHours: 3,
      meetings: [
        { dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '11:30' },
        { dayOfWeek: 'WEDNESDAY', startTime: '10:00', endTime: '11:30', meetingType: 'LAB' },
      ],
    });

    expect(profile).toMatchObject({
      overallIntensity: 4.5,
      estimatedWeeklyHours: 6.75,
      scheduleBurden: 3,
      labIntensity: 6,
      confidence: 0.35,
      source: 'STRUCTURAL_ESTIMATE',
    });
    expect(profile.projectIntensity).toBeUndefined();
    expect(profile.examIntensity).toBeUndefined();
  });

  it('applies a user override without inventing values for missing dimensions', () => {
    const profile = resolveWorkloadProfile(
      {
        creditHours: 3,
        meetings: [{ dayOfWeek: 'TUESDAY', startTime: '12:00', endTime: '13:00' }],
      },
      { projectIntensity: 8, estimatedWeeklyHours: 9, confidence: 0.8 },
    );

    expect(profile).toMatchObject({
      overallIntensity: 4.5,
      projectIntensity: 8,
      estimatedWeeklyHours: 9,
      confidence: 0.8,
      source: 'USER_ESTIMATE',
    });
    expect(profile.quizIntensity).toBeUndefined();
  });

  it('rejects out-of-range profile values', () => {
    expect(() => validateWorkloadProfile({ projectIntensity: 10.1 })).toThrow(
      'Workload profile projectIntensity must be between 0 and 10.',
    );
    expect(() => validateWorkloadProfile({ estimatedWeeklyHours: -1 })).toThrow(
      'Estimated weekly hours must be a finite non-negative number.',
    );
  });
});
