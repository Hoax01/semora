export const MEETING_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type MeetingDay = (typeof MEETING_DAYS)[number];
export type CommitmentFlexibility = 'HARD' | 'SOFT' | 'FLEXIBLE';

export type TimetableMeeting = {
  dayOfWeek: MeetingDay;
  startTime: string;
  endTime: string;
};

export type TimetableCourse = {
  id: string;
  courseOfferingId: string;
  courseCode: string;
  sectionCode: string;
  meetings: TimetableMeeting[];
};

export type TimetableCommitment = {
  id: string;
  name: string;
  flexibility: CommitmentFlexibility;
  meetings: TimetableMeeting[];
};

type ClashParty =
  { kind: 'COURSE'; id: string; label: string } | { kind: 'COMMITMENT'; id: string; label: string };

export type TimetableClash = {
  type: 'COURSE_COURSE' | 'COURSE_HARD_COMMITMENT';
  dayOfWeek: MeetingDay;
  startTime: string;
  endTime: string;
  first: ClashParty;
  second: ClashParty;
};

export type TimetableAnalysis = {
  valid: boolean;
  clashes: TimetableClash[];
};

export function calculateTotalCredits(credits: readonly number[]) {
  const tenths = credits.reduce((total, credit) => {
    if (!Number.isFinite(credit) || credit < 0) {
      throw new Error('Course credits must be finite non-negative numbers.');
    }
    return total + Math.round(credit * 10);
  }, 0);
  return tenths / 10;
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid timetable time: ${value}`);

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid timetable time: ${value}`);
  return hours * 60 + minutes;
}

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function validateMeeting(meeting: TimetableMeeting) {
  const start = parseTime(meeting.startTime);
  const end = parseTime(meeting.endTime);
  if (start >= end) throw new Error('Timetable meetings must end after they start.');
}

function overlap(first: TimetableMeeting, second: TimetableMeeting) {
  const firstStart = parseTime(first.startTime);
  const firstEnd = parseTime(first.endTime);
  const secondStart = parseTime(second.startTime);
  const secondEnd = parseTime(second.endTime);

  if (firstStart >= firstEnd || secondStart >= secondEnd) {
    throw new Error('Timetable meetings must end after they start.');
  }
  if (first.dayOfWeek !== second.dayOfWeek) return undefined;

  const start = Math.max(firstStart, secondStart);
  const end = Math.min(firstEnd, secondEnd);
  return start < end ? { start, end } : undefined;
}

export function detectTimetableClashes(input: {
  courses: TimetableCourse[];
  commitments?: TimetableCommitment[];
}): TimetableAnalysis {
  const clashes: TimetableClash[] = [];
  const commitments = input.commitments ?? [];

  // Validate every interval even when a candidate has only one block. Without
  // this pass, malformed isolated meetings would never reach overlap().
  for (const course of input.courses) course.meetings.forEach(validateMeeting);
  for (const commitment of commitments) commitment.meetings.forEach(validateMeeting);

  for (let firstIndex = 0; firstIndex < input.courses.length; firstIndex += 1) {
    const firstCourse = input.courses[firstIndex];
    if (!firstCourse) continue;

    for (let secondIndex = firstIndex + 1; secondIndex < input.courses.length; secondIndex += 1) {
      const secondCourse = input.courses[secondIndex];
      if (!secondCourse || firstCourse.courseOfferingId === secondCourse.courseOfferingId) continue;

      for (const firstMeeting of firstCourse.meetings) {
        for (const secondMeeting of secondCourse.meetings) {
          const interval = overlap(firstMeeting, secondMeeting);
          if (!interval) continue;
          clashes.push({
            type: 'COURSE_COURSE',
            dayOfWeek: firstMeeting.dayOfWeek,
            startTime: formatTime(interval.start),
            endTime: formatTime(interval.end),
            first: {
              kind: 'COURSE',
              id: firstCourse.id,
              label: `${firstCourse.courseCode} · Section ${firstCourse.sectionCode}`,
            },
            second: {
              kind: 'COURSE',
              id: secondCourse.id,
              label: `${secondCourse.courseCode} · Section ${secondCourse.sectionCode}`,
            },
          });
        }
      }
    }
  }

  for (const course of input.courses) {
    for (const commitment of commitments) {
      if (commitment.flexibility !== 'HARD') continue;

      for (const courseMeeting of course.meetings) {
        for (const commitmentMeeting of commitment.meetings) {
          const interval = overlap(courseMeeting, commitmentMeeting);
          if (!interval) continue;
          clashes.push({
            type: 'COURSE_HARD_COMMITMENT',
            dayOfWeek: courseMeeting.dayOfWeek,
            startTime: formatTime(interval.start),
            endTime: formatTime(interval.end),
            first: {
              kind: 'COURSE',
              id: course.id,
              label: `${course.courseCode} · Section ${course.sectionCode}`,
            },
            second: { kind: 'COMMITMENT', id: commitment.id, label: commitment.name },
          });
        }
      }
    }
  }

  return { valid: clashes.length === 0, clashes };
}
