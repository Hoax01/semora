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
  meetingType?: 'LECTURE' | 'LAB' | 'TUTORIAL' | 'SEMINAR' | 'OTHER';
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

export const WORKLOAD_DIMENSIONS = [
  'overallIntensity',
  'continuousWorkload',
  'assignmentIntensity',
  'quizIntensity',
  'projectIntensity',
  'examIntensity',
  'labIntensity',
  'readingIntensity',
  'scheduleBurden',
  'assessmentFragmentation',
] as const satisfies readonly WorkloadDimension[];

export type WorkloadProfileSource = 'STRUCTURAL_ESTIMATE' | 'USER_ESTIMATE' | 'VERIFIED_OUTLINE';

export type CourseWorkloadProfile = Partial<Record<WorkloadDimension, number | null>> & {
  estimatedWeeklyHours?: number | null;
  confidence?: number;
  source?: WorkloadProfileSource;
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

export type StructuralWorkloadConfig = {
  structuralConfidence: number;
  referenceCreditHours: number;
  baseIntensity: number;
  intensityPerCredit: number;
  baseWeeklyHoursPerCredit: number;
  labIntensity: number;
};

export const DEFAULT_STRUCTURAL_WORKLOAD_CONFIG: StructuralWorkloadConfig = {
  structuralConfidence: 0.35,
  referenceCreditHours: 3,
  baseIntensity: 4.5,
  intensityPerCredit: 0.8,
  baseWeeklyHoursPerCredit: 2,
  labIntensity: 6,
};

export type WorkloadInteractionConfig = {
  projectIntensityThreshold: number;
  continuousWorkloadThreshold: number;
  examIntensityThreshold: number;
  penaltyByHeavyCourseCount: readonly number[];
  additionalHeavyCoursePenalty: number;
};

export const DEFAULT_WORKLOAD_INTERACTION_CONFIG: WorkloadInteractionConfig = {
  projectIntensityThreshold: 7,
  continuousWorkloadThreshold: 7,
  examIntensityThreshold: 7,
  penaltyByHeavyCourseCount: [0, 0, 0.5, 1.5, 3, 5],
  additionalHeavyCoursePenalty: 2,
};

export type CandidateMetricsConfig = {
  referenceCreditHours: number;
  scheduleIdleGapPenaltyPerHour: number;
  scheduleEarlyClassPenaltyPerHour: number;
  scheduleLateClassPenaltyPerHour: number;
  scheduleLongDayPenalty: number;
  scheduleFreeDayBonus: number;
  scheduleFragmentationPenalty: number;
  commitmentFixedHourPenalty: number;
};

export const DEFAULT_CANDIDATE_METRICS_CONFIG: CandidateMetricsConfig = {
  referenceCreditHours: 3,
  scheduleIdleGapPenaltyPerHour: 0.5,
  scheduleEarlyClassPenaltyPerHour: 0.25,
  scheduleLateClassPenaltyPerHour: 0.25,
  scheduleLongDayPenalty: 0.5,
  scheduleFreeDayBonus: 0.5,
  scheduleFragmentationPenalty: 0.15,
  commitmentFixedHourPenalty: 0.25,
};

export type CandidateFindingConfig = {
  longCampusSpanMinutes: number;
  heavyFixedCommitmentHours: number;
  earlyClassPatternMinutes: number;
  lateClassPatternMinutes: number;
  lowDataCompleteness: number;
  veryLowDataCompleteness: number;
};

export const DEFAULT_CANDIDATE_FINDING_CONFIG: CandidateFindingConfig = {
  longCampusSpanMinutes: 8 * 60,
  heavyFixedCommitmentHours: 8,
  earlyClassPatternMinutes: 30,
  lateClassPatternMinutes: 30,
  lowDataCompleteness: 0.5,
  veryLowDataCompleteness: 0.3,
};

export type ResolvedCourseWorkloadProfile = {
  courseId: string;
  courseOfferingId: string;
  courseCode: string;
  profile: CourseWorkloadProfile;
};

export type CandidateScheduleAnalysis = {
  candidateId: string | null;
  engineVersion: '0.1';
  validity: TimetableAnalysis;
  schedule: ScheduleMetrics;
  workloadProfiles: ResolvedCourseWorkloadProfile[];
  coursePreferenceFit: CoursePreferenceFit;
  interactionPenalties: WorkloadInteractionPenalties;
  metrics: CandidateMetrics;
  findings: CandidateFinding[];
};

export type CoursePreferenceFit = {
  interestFit: number | null;
  careerFit: number | null;
  interestKnownCount: number;
  careerKnownCount: number;
  courseCount: number;
  interestCompleteness: number;
  careerCompleteness: number;
};

export type WorkloadInteractionMetric = {
  threshold: number;
  knownCourseCount: number;
  heavyCourseCount: number;
  penalty: number;
};

export type WorkloadInteractionPenalties = {
  projectConcentration: WorkloadInteractionMetric;
  continuousAssessmentConcentration: WorkloadInteractionMetric;
  examConcentration: WorkloadInteractionMetric;
  totalPenalty: number;
};

export type CandidateMetrics = {
  academicIntensity: number | null;
  continuousLoad: number | null;
  projectLoad: number | null;
  examLoad: number | null;
  assessmentFragmentation: number | null;
  scheduleQuality: number | null;
  commitmentCompatibility: number | null;
  interestFit: number | null;
  careerFit: number | null;
  balance: number | null;
  analysisConfidence: number;
  dataCompleteness: number;
};

export type CandidateFindingType =
  | 'TIMETABLE_CLASH'
  | 'COMMITMENT_CLASH'
  | 'PROJECT_CONCENTRATION'
  | 'CONTINUOUS_ASSESSMENT_CONCENTRATION'
  | 'HIGH_EXAM_CONCENTRATION'
  | 'LONG_CAMPUS_DAY'
  | 'FREE_DAY'
  | 'EARLY_CLASS_PATTERN'
  | 'LATE_CLASS_PATTERN'
  | 'HEAVY_FIXED_COMMITMENTS'
  | 'LOW_DATA_COMPLETENESS';

export type CandidateFindingSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CandidateFinding = {
  type: CandidateFindingType;
  severity: CandidateFindingSeverity;
  messageKey: string;
  relatedCourseIds: string[];
  relatedCommitmentIds: string[];
  heavyCourseCount?: number;
  dayOfWeek?: MeetingDay;
  days?: MeetingDay[];
  campusSpanMinutes?: number;
  fixedHours?: number;
  totalMinutes?: number;
  dataCompleteness?: number;
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

function averageCoursePreference(
  courses: readonly CandidateCourseInput[],
  selectScore: (course: CandidateCourseInput) => number | null | undefined,
): {
  value: number | null;
  knownCount: number;
} {
  let total = 0;
  let totalWeight = 0;
  let knownCount = 0;

  for (const course of courses) {
    const score = selectScore(course);
    if (score === undefined || score === null) continue;
    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw new Error('Course preference scores must be finite numbers between 0 and 1.');
    }
    if (!Number.isFinite(course.creditHours) || course.creditHours < 0) {
      throw new Error('Course credits must be finite non-negative numbers.');
    }
    total += score * course.creditHours;
    totalWeight += course.creditHours;
    knownCount += 1;
  }

  return {
    value: totalWeight ? total / totalWeight : null,
    knownCount,
  };
}

export function calculateCoursePreferenceFit(
  courses: readonly CandidateCourseInput[],
): CoursePreferenceFit {
  const interest = averageCoursePreference(courses, (course) => course.interestScore);
  const career = averageCoursePreference(courses, (course) => course.careerRelevanceScore);
  const courseCount = courses.length;

  return {
    interestFit: interest.value,
    careerFit: career.value,
    interestKnownCount: interest.knownCount,
    careerKnownCount: career.knownCount,
    courseCount,
    interestCompleteness: courseCount ? interest.knownCount / courseCount : 0,
    careerCompleteness: courseCount ? career.knownCount / courseCount : 0,
  };
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function validateStructuralWorkloadConfig(config: StructuralWorkloadConfig) {
  if (
    !Number.isFinite(config.structuralConfidence) ||
    config.structuralConfidence < 0 ||
    config.structuralConfidence > 1 ||
    !Number.isFinite(config.referenceCreditHours) ||
    config.referenceCreditHours <= 0 ||
    !Number.isFinite(config.baseIntensity) ||
    !Number.isFinite(config.intensityPerCredit) ||
    !Number.isFinite(config.baseWeeklyHoursPerCredit) ||
    config.baseWeeklyHoursPerCredit < 0 ||
    !Number.isFinite(config.labIntensity) ||
    config.labIntensity < 0 ||
    config.labIntensity > 10
  ) {
    throw new Error('Structural workload configuration contains invalid values.');
  }
}

export function validateWorkloadProfile(profile: CourseWorkloadProfile) {
  for (const dimension of WORKLOAD_DIMENSIONS) {
    const value = profile[dimension];
    if (
      value !== undefined &&
      value !== null &&
      (!Number.isFinite(value) || value < 0 || value > 10)
    ) {
      throw new Error(`Workload profile ${dimension} must be between 0 and 10.`);
    }
  }
  if (
    profile.estimatedWeeklyHours !== undefined &&
    profile.estimatedWeeklyHours !== null &&
    (!Number.isFinite(profile.estimatedWeeklyHours) || profile.estimatedWeeklyHours < 0)
  ) {
    throw new Error('Estimated weekly hours must be a finite non-negative number.');
  }
  if (
    profile.confidence !== undefined &&
    (!Number.isFinite(profile.confidence) || profile.confidence < 0 || profile.confidence > 1)
  ) {
    throw new Error('Workload profile confidence must be between 0 and 1.');
  }
}

export function estimateStructuralWorkloadProfile(
  course: Pick<CandidateCourseInput, 'creditHours' | 'meetings'>,
  config: StructuralWorkloadConfig = DEFAULT_STRUCTURAL_WORKLOAD_CONFIG,
): CourseWorkloadProfile {
  validateStructuralWorkloadConfig(config);
  if (!Number.isFinite(course.creditHours) || course.creditHours < 0) {
    throw new Error('Course credits must be finite non-negative numbers.');
  }

  let totalMeetingMinutes = 0;
  let hasLab = false;
  for (const meeting of course.meetings) {
    const start = parseTime(meeting.startTime);
    const end = parseTime(meeting.endTime);
    if (start >= end) throw new Error('Timetable meetings must end after they start.');
    totalMeetingMinutes += end - start;
    hasLab ||= meeting.meetingType === 'LAB';
  }

  const profile: CourseWorkloadProfile = {
    overallIntensity: clamp(
      config.baseIntensity +
        (course.creditHours - config.referenceCreditHours) * config.intensityPerCredit,
      0,
      10,
    ),
    estimatedWeeklyHours: roundMetric(
      course.creditHours * config.baseWeeklyHoursPerCredit + (totalMeetingMinutes / 60) * 0.25,
    ),
    confidence: config.structuralConfidence,
    source: 'STRUCTURAL_ESTIMATE',
  };

  if (course.meetings.length) {
    profile.scheduleBurden = roundMetric(clamp(2 + totalMeetingMinutes / 180, 0, 10));
  }
  if (hasLab) profile.labIntensity = config.labIntensity;

  return profile;
}

export function resolveWorkloadProfile(
  course: Pick<CandidateCourseInput, 'creditHours' | 'meetings'>,
  override?: CourseWorkloadProfile,
  config: StructuralWorkloadConfig = DEFAULT_STRUCTURAL_WORKLOAD_CONFIG,
): CourseWorkloadProfile {
  const structural = estimateStructuralWorkloadProfile(course, config);
  if (!override) return structural;
  validateWorkloadProfile(override);
  const resolved = { ...structural };
  for (const dimension of WORKLOAD_DIMENSIONS) {
    const value = override[dimension];
    if (value !== undefined && value !== null) resolved[dimension] = value;
  }
  if (override.estimatedWeeklyHours !== undefined && override.estimatedWeeklyHours !== null) {
    resolved.estimatedWeeklyHours = override.estimatedWeeklyHours;
  }
  return {
    ...resolved,
    confidence: override.confidence ?? 0.8,
    source: override.source ?? 'USER_ESTIMATE',
  };
}

function interactionPenaltyForCount(heavyCourseCount: number, config: WorkloadInteractionConfig) {
  if (heavyCourseCount < 2) return 0;
  const configuredPenalty = config.penaltyByHeavyCourseCount[heavyCourseCount];
  if (configuredPenalty !== undefined) return configuredPenalty;

  const lastConfiguredIndex = config.penaltyByHeavyCourseCount.length - 1;
  const lastConfiguredPenalty = config.penaltyByHeavyCourseCount[lastConfiguredIndex] ?? 0;
  return (
    lastConfiguredPenalty +
    (heavyCourseCount - lastConfiguredIndex) * config.additionalHeavyCoursePenalty
  );
}

function interactionMetric(
  profiles: readonly CourseWorkloadProfile[],
  dimension: WorkloadDimension,
  threshold: number,
  config: WorkloadInteractionConfig,
): WorkloadInteractionMetric {
  const knownProfiles = profiles.filter(
    (profile) => profile[dimension] !== undefined && profile[dimension] !== null,
  );
  const heavyCourseCount = knownProfiles.filter(
    (profile) => (profile[dimension] ?? 0) >= threshold,
  ).length;

  return {
    threshold,
    knownCourseCount: knownProfiles.length,
    heavyCourseCount,
    penalty: interactionPenaltyForCount(heavyCourseCount, config),
  };
}

export function calculateWorkloadInteractionPenalties(
  profiles: readonly CourseWorkloadProfile[],
  config: WorkloadInteractionConfig = DEFAULT_WORKLOAD_INTERACTION_CONFIG,
): WorkloadInteractionPenalties {
  const projectConcentration = interactionMetric(
    profiles,
    'projectIntensity',
    config.projectIntensityThreshold,
    config,
  );
  const continuousAssessmentConcentration = interactionMetric(
    profiles,
    'continuousWorkload',
    config.continuousWorkloadThreshold,
    config,
  );
  const examConcentration = interactionMetric(
    profiles,
    'examIntensity',
    config.examIntensityThreshold,
    config,
  );

  return {
    projectConcentration,
    continuousAssessmentConcentration,
    examConcentration,
    totalPenalty:
      projectConcentration.penalty +
      continuousAssessmentConcentration.penalty +
      examConcentration.penalty,
  };
}

function weightedProfileMean(
  courses: readonly CandidateCourseInput[],
  profiles: readonly ResolvedCourseWorkloadProfile[],
  dimension: WorkloadDimension,
  config: CandidateMetricsConfig,
) {
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const resolved of profiles) {
    const value = resolved.profile[dimension];
    const course = coursesById.get(resolved.courseId);
    if (value === undefined || value === null || !course) continue;
    if (!Number.isFinite(course.creditHours) || course.creditHours < 0) {
      throw new Error('Course credits must be finite non-negative numbers.');
    }
    const weight = Math.sqrt(course.creditHours / config.referenceCreditHours);
    weightedTotal += value * weight;
    totalWeight += weight;
  }

  return totalWeight ? roundMetric(weightedTotal / totalWeight) : null;
}

function addPenalty(value: number | null, penalty: number) {
  return value === null ? null : roundMetric(clamp(value + penalty, 0, 10));
}

function calculateScheduleQuality(
  schedule: ScheduleMetrics,
  preferences: CandidatePreferencesInput | undefined,
  config: CandidateMetricsConfig,
) {
  const earlyClassAversion = preferences?.earlyClassAversion ?? 0.5;
  const lateClassAversion = preferences?.lateClassAversion ?? 0.5;
  const freeDayPriority = preferences?.freeDayPriority ?? 0.5;
  const penalty =
    (schedule.totalIdleGapMinutes / 60) * config.scheduleIdleGapPenaltyPerHour +
    (schedule.earlyClassMinutes / 60) *
      config.scheduleEarlyClassPenaltyPerHour *
      (0.5 + earlyClassAversion) +
    (schedule.lateClassMinutes / 60) *
      config.scheduleLateClassPenaltyPerHour *
      (0.5 + lateClassAversion) +
    schedule.longDays.length * config.scheduleLongDayPenalty +
    schedule.scheduleFragmentation * config.scheduleFragmentationPenalty -
    schedule.freeDays.length * config.scheduleFreeDayBonus * (0.5 + freeDayPriority);

  return roundMetric(clamp(10 - penalty, 0, 10));
}

function meetingMinutes(meetings: readonly TimetableMeeting[]) {
  return meetings.reduce((total, meeting) => {
    const start = parseTime(meeting.startTime);
    const end = parseTime(meeting.endTime);
    if (start >= end) throw new Error('Timetable meetings must end after they start.');
    return total + end - start;
  }, 0);
}

function calculateFixedCommitmentHours(commitments: readonly CandidateCommitmentInput[]) {
  return commitments.reduce(
    (total, commitment) =>
      total + (commitment.weeklyEffortHours ?? 0) + meetingMinutes(commitment.meetings) / 60,
    0,
  );
}

function calculateCommitmentCompatibility(
  courses: readonly CandidateCourseInput[],
  commitments: readonly CandidateCommitmentInput[],
  validity: TimetableAnalysis,
  config: CandidateMetricsConfig,
) {
  if (!courses.length) return null;
  if (validity.clashes.some((clash) => clash.type === 'COURSE_HARD_COMMITMENT')) return 0;

  const fixedHours = calculateFixedCommitmentHours(commitments);
  return roundMetric(clamp(10 - fixedHours * config.commitmentFixedHourPenalty, 0, 10));
}

function calculateBalance(
  courses: readonly CandidateCourseInput[],
  profiles: readonly ResolvedCourseWorkloadProfile[],
  config: CandidateMetricsConfig,
) {
  const dimensionValues = (
    [
      'continuousWorkload',
      'projectIntensity',
      'examIntensity',
      'readingIntensity',
      'labIntensity',
    ] as const
  )
    .map((dimension) => weightedProfileMean(courses, profiles, dimension, config))
    .filter((value): value is number => value !== null);

  if (dimensionValues.length < 2) return null;
  const mean = dimensionValues.reduce((total, value) => total + value, 0) / dimensionValues.length;
  const variance =
    dimensionValues.reduce((total, value) => total + (value - mean) ** 2, 0) /
    dimensionValues.length;
  return roundMetric(clamp(10 - Math.sqrt(variance) * 2, 0, 10));
}

function calculateDataCompleteness(
  courses: readonly CandidateCourseInput[],
  profiles: readonly ResolvedCourseWorkloadProfile[],
  coursePreferenceFit: CoursePreferenceFit,
) {
  const scheduleCompleteness = courses.length
    ? courses.filter((course) => course.meetings.length > 0).length / courses.length
    : 0;
  const expectedWorkloadValues = profiles.length * WORKLOAD_DIMENSIONS.length;
  const knownWorkloadValues = profiles.reduce(
    (total, resolved) =>
      total +
      WORKLOAD_DIMENSIONS.filter(
        (dimension) =>
          resolved.profile[dimension] !== undefined && resolved.profile[dimension] !== null,
      ).length,
    0,
  );
  const workloadCompleteness = expectedWorkloadValues
    ? knownWorkloadValues / expectedWorkloadValues
    : 0;
  const preferenceCompleteness = coursePreferenceFit.courseCount
    ? (coursePreferenceFit.interestCompleteness + coursePreferenceFit.careerCompleteness) / 2
    : 0;

  return roundMetric(
    clamp(
      scheduleCompleteness * 0.3 + workloadCompleteness * 0.5 + preferenceCompleteness * 0.2,
      0,
      1,
    ),
  );
}

function calculateAnalysisConfidence(
  courses: readonly CandidateCourseInput[],
  profiles: readonly ResolvedCourseWorkloadProfile[],
) {
  if (!courses.length) return 0;
  const scheduleConfidence = courses.every((course) => course.meetings.length > 0) ? 1 : 0.5;
  let knownValues = 0;
  let weightedConfidence = 0;
  for (const resolved of profiles) {
    const knownDimensions = WORKLOAD_DIMENSIONS.filter(
      (dimension) =>
        resolved.profile[dimension] !== undefined && resolved.profile[dimension] !== null,
    ).length;
    knownValues += knownDimensions;
    weightedConfidence += knownDimensions * (resolved.profile.confidence ?? 0);
  }
  const workloadConfidence = knownValues ? weightedConfidence / knownValues : 0;
  return roundMetric((scheduleConfidence + workloadConfidence) / 2);
}

export type CandidateMetricsInput = {
  courses: readonly CandidateCourseInput[];
  commitments: readonly CandidateCommitmentInput[];
  preferences?: CandidatePreferencesInput | undefined;
  validity: TimetableAnalysis;
  schedule: ScheduleMetrics;
  workloadProfiles: readonly ResolvedCourseWorkloadProfile[];
  coursePreferenceFit: CoursePreferenceFit;
  interactionPenalties: WorkloadInteractionPenalties;
};

export type CandidateFindingInput = CandidateMetricsInput & {
  metrics: CandidateMetrics;
};

export function calculateCandidateMetrics(
  input: CandidateMetricsInput,
  config: CandidateMetricsConfig = DEFAULT_CANDIDATE_METRICS_CONFIG,
): CandidateMetrics {
  const academicIntensity = addPenalty(
    weightedProfileMean(input.courses, input.workloadProfiles, 'overallIntensity', config),
    input.interactionPenalties.totalPenalty,
  );
  const continuousLoad = addPenalty(
    weightedProfileMean(input.courses, input.workloadProfiles, 'continuousWorkload', config),
    input.interactionPenalties.continuousAssessmentConcentration.penalty,
  );
  const projectLoad = addPenalty(
    weightedProfileMean(input.courses, input.workloadProfiles, 'projectIntensity', config),
    input.interactionPenalties.projectConcentration.penalty,
  );
  const examLoad = addPenalty(
    weightedProfileMean(input.courses, input.workloadProfiles, 'examIntensity', config),
    input.interactionPenalties.examConcentration.penalty,
  );

  return {
    academicIntensity,
    continuousLoad,
    projectLoad,
    examLoad,
    assessmentFragmentation: weightedProfileMean(
      input.courses,
      input.workloadProfiles,
      'assessmentFragmentation',
      config,
    ),
    scheduleQuality: input.courses.length
      ? calculateScheduleQuality(input.schedule, input.preferences, config)
      : null,
    commitmentCompatibility: calculateCommitmentCompatibility(
      input.courses,
      input.commitments,
      input.validity,
      config,
    ),
    interestFit:
      input.coursePreferenceFit.interestFit === null
        ? null
        : roundMetric(input.coursePreferenceFit.interestFit * 10),
    careerFit:
      input.coursePreferenceFit.careerFit === null
        ? null
        : roundMetric(input.coursePreferenceFit.careerFit * 10),
    balance: calculateBalance(input.courses, input.workloadProfiles, config),
    analysisConfidence: calculateAnalysisConfidence(input.courses, input.workloadProfiles),
    dataCompleteness: calculateDataCompleteness(
      input.courses,
      input.workloadProfiles,
      input.coursePreferenceFit,
    ),
  };
}

function relatedCourseIdsForDimension(
  profiles: readonly ResolvedCourseWorkloadProfile[],
  dimension: WorkloadDimension,
  threshold: number,
) {
  return profiles
    .filter((resolved) => (resolved.profile[dimension] ?? -1) >= threshold)
    .map((resolved) => resolved.courseId);
}

function concentrationFinding(
  type: CandidateFindingType,
  messageKey: string,
  relatedCourseIds: string[],
  heavyCourseCount: number,
  highSeverityCount = 3,
): CandidateFinding {
  return {
    type,
    severity: heavyCourseCount >= highSeverityCount ? 'HIGH' : 'MEDIUM',
    messageKey,
    relatedCourseIds,
    relatedCommitmentIds: [],
    heavyCourseCount,
  };
}

export function calculateCandidateFindings(
  input: CandidateFindingInput,
  config: CandidateFindingConfig = DEFAULT_CANDIDATE_FINDING_CONFIG,
): CandidateFinding[] {
  const findings: CandidateFinding[] = [];

  for (const clash of input.validity.clashes) {
    const relatedCourseIds = [clash.first, clash.second]
      .filter((party) => party.kind === 'COURSE')
      .map((party) => party.id);
    const relatedCommitmentIds = [clash.first, clash.second]
      .filter((party) => party.kind === 'COMMITMENT')
      .map((party) => party.id);
    findings.push({
      type: clash.type === 'COURSE_COURSE' ? 'TIMETABLE_CLASH' : 'COMMITMENT_CLASH',
      severity: 'CRITICAL',
      messageKey:
        clash.type === 'COURSE_COURSE' ? 'course_timetable_clash' : 'course_hard_commitment_clash',
      relatedCourseIds,
      relatedCommitmentIds,
      totalMinutes:
        Number(clash.endTime.slice(0, 2)) * 60 +
        Number(clash.endTime.slice(3)) -
        (Number(clash.startTime.slice(0, 2)) * 60 + Number(clash.startTime.slice(3))),
    });
  }

  const projectCount = input.interactionPenalties.projectConcentration.heavyCourseCount;
  if (projectCount >= 2) {
    findings.push(
      concentrationFinding(
        'PROJECT_CONCENTRATION',
        projectCount >= 3 ? 'three_project_heavy_courses' : 'multiple_project_heavy_courses',
        relatedCourseIdsForDimension(
          input.workloadProfiles,
          'projectIntensity',
          input.interactionPenalties.projectConcentration.threshold,
        ),
        projectCount,
      ),
    );
  }

  const continuousCount =
    input.interactionPenalties.continuousAssessmentConcentration.heavyCourseCount;
  if (continuousCount >= 2) {
    findings.push(
      concentrationFinding(
        'CONTINUOUS_ASSESSMENT_CONCENTRATION',
        continuousCount >= 3
          ? 'multiple_continuous_assessment_heavy_courses'
          : 'continuous_assessment_concentration',
        relatedCourseIdsForDimension(
          input.workloadProfiles,
          'continuousWorkload',
          input.interactionPenalties.continuousAssessmentConcentration.threshold,
        ),
        continuousCount,
        4,
      ),
    );
  }

  const examCount = input.interactionPenalties.examConcentration.heavyCourseCount;
  if (examCount >= 2) {
    findings.push(
      concentrationFinding(
        'HIGH_EXAM_CONCENTRATION',
        examCount >= 3 ? 'multiple_exam_heavy_courses' : 'exam_concentration',
        relatedCourseIdsForDimension(
          input.workloadProfiles,
          'examIntensity',
          input.interactionPenalties.examConcentration.threshold,
        ),
        examCount,
        4,
      ),
    );
  }

  if (
    input.schedule.longestDay &&
    input.schedule.longestCampusSpanMinutes >= config.longCampusSpanMinutes
  ) {
    findings.push({
      type: 'LONG_CAMPUS_DAY',
      severity: 'MEDIUM',
      messageKey: 'long_campus_day',
      relatedCourseIds: [],
      relatedCommitmentIds: [],
      dayOfWeek: input.schedule.longestDay,
      campusSpanMinutes: input.schedule.longestCampusSpanMinutes,
    });
  }

  if (input.schedule.earlyClassMinutes >= config.earlyClassPatternMinutes) {
    findings.push({
      type: 'EARLY_CLASS_PATTERN',
      severity: input.schedule.earlyClassMinutes >= 60 ? 'MEDIUM' : 'LOW',
      messageKey: 'early_class_pattern',
      relatedCourseIds: [],
      relatedCommitmentIds: [],
      totalMinutes: input.schedule.earlyClassMinutes,
    });
  }

  if (input.schedule.lateClassMinutes >= config.lateClassPatternMinutes) {
    findings.push({
      type: 'LATE_CLASS_PATTERN',
      severity: input.schedule.lateClassMinutes >= 60 ? 'MEDIUM' : 'LOW',
      messageKey: 'late_class_pattern',
      relatedCourseIds: [],
      relatedCommitmentIds: [],
      totalMinutes: input.schedule.lateClassMinutes,
    });
  }

  const fixedHours = calculateFixedCommitmentHours(input.commitments);
  if (fixedHours >= config.heavyFixedCommitmentHours) {
    findings.push({
      type: 'HEAVY_FIXED_COMMITMENTS',
      severity: fixedHours >= config.heavyFixedCommitmentHours * 1.5 ? 'HIGH' : 'MEDIUM',
      messageKey: 'heavy_fixed_commitments',
      relatedCourseIds: [],
      relatedCommitmentIds: input.commitments.map((commitment) => commitment.id),
      fixedHours: roundMetric(fixedHours),
    });
  }

  if (input.schedule.freeDays.length) {
    findings.push({
      type: 'FREE_DAY',
      severity: 'INFO',
      messageKey: 'free_day',
      relatedCourseIds: [],
      relatedCommitmentIds: [],
      days: input.schedule.freeDays,
    });
  }

  if (input.metrics.dataCompleteness < config.lowDataCompleteness) {
    findings.push({
      type: 'LOW_DATA_COMPLETENESS',
      severity: input.metrics.dataCompleteness < config.veryLowDataCompleteness ? 'MEDIUM' : 'LOW',
      messageKey: 'low_data_completeness',
      relatedCourseIds: [],
      relatedCommitmentIds: [],
      dataCompleteness: input.metrics.dataCompleteness,
    });
  }

  return findings;
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

  const workloadProfiles = input.courses.map((course) => ({
    courseId: course.id,
    courseOfferingId: course.courseOfferingId,
    courseCode: course.courseCode,
    profile: resolveWorkloadProfile(course, course.workloadProfile),
  }));

  const coursePreferenceFit = calculateCoursePreferenceFit(input.courses);
  const interactionPenalties = calculateWorkloadInteractionPenalties(
    workloadProfiles.map((course) => course.profile),
  );
  const schedule = calculateScheduleMetrics(input.courses, config);
  const metrics = calculateCandidateMetrics({
    courses: input.courses,
    commitments: input.commitments,
    preferences: input.preferences,
    validity,
    schedule,
    workloadProfiles,
    coursePreferenceFit,
    interactionPenalties,
  });

  return {
    candidateId: input.candidateId ?? null,
    engineVersion: '0.1',
    validity,
    schedule,
    workloadProfiles,
    coursePreferenceFit,
    interactionPenalties,
    metrics,
    findings: calculateCandidateFindings({
      courses: input.courses,
      commitments: input.commitments,
      preferences: input.preferences,
      validity,
      schedule,
      workloadProfiles,
      coursePreferenceFit,
      interactionPenalties,
      metrics,
    }),
  };
}
