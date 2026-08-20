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

export type WorkloadDimension =
  | 'overallIntensity'
  | 'continuousWorkload'
  | 'assignmentIntensity'
  | 'quizIntensity'
  | 'projectIntensity'
  | 'examIntensity'
  | 'labIntensity'
  | 'readingIntensity'
  | 'scheduleBurden'
  | 'assessmentFragmentation';

export type CourseWorkloadProfile = Partial<Record<WorkloadDimension, number | null>> & {
  estimatedWeeklyHours?: number | null;
  confidence?: number;
  source?: 'STRUCTURAL_ESTIMATE' | 'USER_ESTIMATE' | 'VERIFIED_OUTLINE';
};

export type CandidateCourseInput = {
  id: string;
  courseOfferingId: string;
  courseCode: string;
  courseTitle: string;
  creditHours: number;
  sectionCode: string;
  meetings: TimetableMeeting[];
  workloadProfile?: CourseWorkloadProfile;
  interestScore?: number | null;
  careerRelevanceScore?: number | null;
};

export type CandidateCommitmentInput = TimetableCommitment & {
  category?: string;
  weeklyEffortHours?: number;
};

export type CandidatePreferencesInput = {
  workloadPriority?: number;
  schedulePriority?: number;
  careerPriority?: number;
  interestPriority?: number;
  gradeSafetyPriority?: number;
  projectPreference?: number;
  examPreference?: number;
  continuousAssessmentPreference?: number;
  freeDayPriority?: number;
  earlyClassAversion?: number;
  lateClassAversion?: number;
  maxPreferredHardCourses?: number | null;
};

export type CandidateConstraintsInput = {
  minimumCredits?: number;
  maximumCredits?: number;
  maximumHardCourses?: number;
  requiredFreeDays?: MeetingDay[];
  earliestClassTime?: string;
  latestClassTime?: string;
};

export type CandidateSemesterInput = {
  candidateId?: string;
  courses: CandidateCourseInput[];
  commitments: CandidateCommitmentInput[];
  preferences?: CandidatePreferencesInput;
  constraints?: CandidateConstraintsInput;
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

export type ScheduleDayMetrics = {
  dayOfWeek: MeetingDay;
  classMinutes: number;
  campusSpanMinutes: number;
  idleGapMinutes: number;
  blockCount: number;
  earliestStartTime: string | null;
  latestEndTime: string | null;
  earlyClassMinutes: number;
  lateClassMinutes: number;
  fragmentationScore: number;
  isLongDay: boolean;
};

export type ScheduleMetrics = {
  days: Record<MeetingDay, ScheduleDayMetrics>;
  totalClassMinutes: number;
  totalIdleGapMinutes: number;
  scheduledDays: MeetingDay[];
  freeDays: MeetingDay[];
  longestDay: MeetingDay | null;
  longestCampusSpanMinutes: number;
  longDays: MeetingDay[];
  earlyClassMinutes: number;
  lateClassMinutes: number;
  scheduleFragmentation: number;
};

export type ScheduleMetricsConfig = {
  meaningfulGapMinutes: number;
  earlyClassThresholdMinutes: number;
  lateClassThresholdMinutes: number;
  longDayMinutes: number;
};

export const DEFAULT_SCHEDULE_METRICS_CONFIG: ScheduleMetricsConfig = {
  meaningfulGapMinutes: 20,
  earlyClassThresholdMinutes: 9 * 60,
  lateClassThresholdMinutes: 18 * 60,
  longDayMinutes: 6 * 60,
};

export type CandidateScheduleAnalysis = {
  candidateId: string | null;
  engineVersion: '0.1';
  validity: TimetableAnalysis;
  schedule: ScheduleMetrics;
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

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
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

type ScheduleEvent = {
  start: number;
  end: number;
};

function mergeScheduleEvents(events: ScheduleEvent[]) {
  const merged: ScheduleEvent[] = [];
  for (const event of events.sort(
    (first, second) => first.start - second.start || first.end - second.end,
  )) {
    const previous = merged.at(-1);
    if (previous && event.start <= previous.end) {
      previous.end = Math.max(previous.end, event.end);
    } else {
      merged.push({ ...event });
    }
  }
  return merged;
}

function validateScheduleMetricsConfig(config: ScheduleMetricsConfig) {
  if (
    !Number.isFinite(config.meaningfulGapMinutes) ||
    config.meaningfulGapMinutes < 0 ||
    !Number.isFinite(config.earlyClassThresholdMinutes) ||
    !Number.isFinite(config.lateClassThresholdMinutes) ||
    !Number.isFinite(config.longDayMinutes) ||
    config.longDayMinutes <= 0
  ) {
    throw new Error('Schedule metrics configuration contains invalid values.');
  }
}

export function calculateScheduleMetrics(
  courses: readonly CandidateCourseInput[],
  config: ScheduleMetricsConfig = DEFAULT_SCHEDULE_METRICS_CONFIG,
): ScheduleMetrics {
  validateScheduleMetricsConfig(config);

  const eventsByDay = new Map<MeetingDay, ScheduleEvent[]>();
  for (const day of MEETING_DAYS) eventsByDay.set(day, []);

  for (const course of courses) {
    for (const meeting of course.meetings) {
      const start = parseTime(meeting.startTime);
      const end = parseTime(meeting.endTime);
      if (start >= end) throw new Error('Timetable meetings must end after they start.');
      eventsByDay.get(meeting.dayOfWeek)?.push({ start, end });
    }
  }

  const days = {} as Record<MeetingDay, ScheduleDayMetrics>;
  for (const day of MEETING_DAYS) {
    const blocks = mergeScheduleEvents(eventsByDay.get(day) ?? []);
    const firstBlock = blocks[0];
    const lastBlock = blocks.at(-1);
    const idleGapMinutes = blocks.reduce(
      (total, block, index) => (index === 0 ? total : total + block.start - blocks[index - 1]!.end),
      0,
    );
    const classMinutes = blocks.reduce((total, block) => total + block.end - block.start, 0);
    const campusSpanMinutes = firstBlock && lastBlock ? lastBlock.end - firstBlock.start : 0;
    const earlyClassMinutes = blocks.reduce(
      (total, block) =>
        total + Math.max(0, Math.min(block.end, config.earlyClassThresholdMinutes) - block.start),
      0,
    );
    const lateClassMinutes = blocks.reduce(
      (total, block) =>
        total + Math.max(0, block.end - Math.max(block.start, config.lateClassThresholdMinutes)),
      0,
    );
    const fragmentationScore =
      blocks.length +
      blocks
        .slice(1)
        .reduce(
          (total, block, index) =>
            total +
            Math.max(0, block.start - blocks[index]!.end - config.meaningfulGapMinutes) / 60,
          0,
        );

    days[day] = {
      dayOfWeek: day,
      classMinutes,
      campusSpanMinutes,
      idleGapMinutes,
      blockCount: blocks.length,
      earliestStartTime: firstBlock ? formatTime(firstBlock.start) : null,
      latestEndTime: lastBlock ? formatTime(lastBlock.end) : null,
      earlyClassMinutes,
      lateClassMinutes,
      fragmentationScore: roundMetric(fragmentationScore),
      isLongDay: classMinutes >= config.longDayMinutes,
    };
  }

  const scheduledDays = MEETING_DAYS.filter((day) => days[day].blockCount > 0);
  const freeDays = MEETING_DAYS.filter((day) => days[day].blockCount === 0);
  const longestDay = scheduledDays.reduce<MeetingDay | null>(
    (longest, day) =>
      !longest || days[day].campusSpanMinutes > days[longest].campusSpanMinutes ? day : longest,
    null,
  );
  const totalClassMinutes = scheduledDays.reduce((total, day) => total + days[day].classMinutes, 0);
  const totalIdleGapMinutes = scheduledDays.reduce(
    (total, day) => total + days[day].idleGapMinutes,
    0,
  );
  const earlyClassMinutes = scheduledDays.reduce(
    (total, day) => total + days[day].earlyClassMinutes,
    0,
  );
  const lateClassMinutes = scheduledDays.reduce(
    (total, day) => total + days[day].lateClassMinutes,
    0,
  );

  return {
    days,
    totalClassMinutes,
    totalIdleGapMinutes,
    scheduledDays,
    freeDays,
    longestDay,
    longestCampusSpanMinutes: longestDay ? days[longestDay].campusSpanMinutes : 0,
    longDays: scheduledDays.filter((day) => days[day].isLongDay),
    earlyClassMinutes,
    lateClassMinutes,
    scheduleFragmentation: roundMetric(
      scheduledDays.length
        ? scheduledDays.reduce((total, day) => total + days[day].fragmentationScore, 0) /
            scheduledDays.length
        : 0,
    ),
  };
}

export function analyzeCandidateSchedule(
  input: CandidateSemesterInput,
  config: ScheduleMetricsConfig = DEFAULT_SCHEDULE_METRICS_CONFIG,
): CandidateScheduleAnalysis {
  const validity = detectTimetableClashes({
    courses: input.courses.map((course) => ({
      id: course.id,
      courseOfferingId: course.courseOfferingId,
      courseCode: course.courseCode,
      sectionCode: course.sectionCode,
      meetings: course.meetings,
    })),
    commitments: input.commitments,
  });

  return {
    candidateId: input.candidateId ?? null,
    engineVersion: '0.1',
    validity,
    schedule: calculateScheduleMetrics(input.courses, config),
  };
}
