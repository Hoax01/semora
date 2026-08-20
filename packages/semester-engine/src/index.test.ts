import { describe, expect, it } from 'vitest';
import {
  analyzeCandidateSchedule,
  calculateScheduleMetrics,
  calculateTotalCredits,
  detectTimetableClashes,
  type CandidateCourseInput,
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
  });
});
