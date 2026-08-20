import { describe, expect, it } from 'vitest';
import { calculateTotalCredits, detectTimetableClashes, type TimetableCourse } from './index.js';

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
