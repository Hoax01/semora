import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { InlineState, LoadingState, PageState } from '../components/ui-state';

type Candidate = {
  id: string;
  name: string;
  isArchived: boolean;
  selectionCount: number;
  credits: number;
  selections: Selection[];
};

type CandidateValidation = {
  candidateId: string;
  valid: boolean;
  clashes: TimetableClash[];
};

type ScheduleDayMetrics = {
  dayOfWeek: string;
  classMinutes: number;
  campusSpanMinutes: number;
  idleGapMinutes: number;
  idleGapPenaltyMinutes: number;
  blockCount: number;
  earliestStartTime: string | null;
  latestEndTime: string | null;
  earlyClassMinutes: number;
  lateClassMinutes: number;
  fragmentationScore: number;
  isLongDay: boolean;
};

type CandidateAnalysis = {
  candidateId: string;
  engineVersion: string;
  totalCredits: number;
  validity: CandidateValidation;
  workloadProfiles: Array<{
    courseId: string;
    courseOfferingId: string;
    courseCode: string;
    profile: WorkloadProfile;
  }>;
  coursePreferenceFit: {
    interestFit: number | null;
    careerFit: number | null;
    interestKnownCount: number;
    careerKnownCount: number;
    courseCount: number;
    interestCompleteness: number;
    careerCompleteness: number;
  };
  interactionPenalties: {
    projectConcentration: InteractionPenaltyMetric;
    continuousAssessmentConcentration: InteractionPenaltyMetric;
    examConcentration: InteractionPenaltyMetric;
    totalPenalty: number;
  };
  metrics: {
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
  findings: CandidateFinding[];
  schedule: {
    days: Record<string, ScheduleDayMetrics>;
    totalClassMinutes: number;
    totalIdleGapMinutes: number;
    totalIdleGapPenaltyMinutes: number;
    scheduledDays: string[];
    freeDays: string[];
    longestDay: string | null;
    longestCampusSpanMinutes: number;
    longDays: string[];
    earlyClassMinutes: number;
    lateClassMinutes: number;
    scheduleFragmentation: number;
  };
};

type InteractionPenaltyMetric = {
  threshold: number;
  knownCourseCount: number;
  heavyCourseCount: number;
  penalty: number;
};

type CandidateFinding = {
  type: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  messageKey: string;
  relatedCourseIds: string[];
  relatedCommitmentIds: string[];
  heavyCourseCount?: number;
  dayOfWeek?: string;
  days?: string[];
  campusSpanMinutes?: number;
  fixedHours?: number;
  totalMinutes?: number;
  dataCompleteness?: number;
  constraintType?: string;
  actualValue?: number | string;
  expectedValue?: number | string;
};

type CandidateComparisonMetricKey =
  | 'academicIntensity'
  | 'continuousLoad'
  | 'projectLoad'
  | 'examLoad'
  | 'assessmentFragmentation'
  | 'scheduleQuality'
  | 'commitmentCompatibility'
  | 'interestFit'
  | 'careerFit'
  | 'balance'
  | 'analysisConfidence'
  | 'dataCompleteness';

type CandidateComparison = {
  candidates: Array<{
    candidateId: string;
    name: string;
    analysis: CandidateAnalysis;
    preferenceMatchScore: number | null;
    recommendationTags: string[];
  }>;
  metricDifferences: Array<{
    metric: CandidateComparisonMetricKey;
    label: string;
    values: Array<{ candidateId: string; value: number | null }>;
    delta: number | null;
    meaningful: boolean;
    betterCandidateIds: string[];
    lowerIsBetter: boolean;
  }>;
  tradeoffs: Array<{
    metric: CandidateComparisonMetricKey;
    messageKey: string;
    betterCandidateId: string;
    worseCandidateId: string;
    delta: number;
  }>;
};

type WorkloadDimension =
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

type WorkloadProfile = Partial<Record<WorkloadDimension, number | null>> & {
  estimatedWeeklyHours: number | null;
  confidence: number;
  source: string;
};

type TimetableClash = {
  type: 'COURSE_COURSE' | 'COURSE_HARD_COMMITMENT';
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  first: { kind: 'COURSE' | 'COMMITMENT'; id: string; label: string };
  second: { kind: 'COURSE' | 'COMMITMENT'; id: string; label: string };
};

type Selection = {
  id: string;
  sectionId: string;
  sectionCode: string;
  capacity: number | null;
  instructor: string | null;
  courseOfferingId: string;
  courseCode: string;
  title: string;
  credits: number;
  meetings: Meeting[];
};

type ActiveCourseSelection = Selection & {
  status: 'ACTIVE' | 'DROPPED';
  addedAt: string;
  droppedAt: string | null;
  state: {
    id: string;
    dataCompleteness: number;
    dataConfidence: number;
    outline: {
      documentId: string;
      filename: string;
      extractionJob: {
        id: string;
        status: string;
        verificationState: string | null;
      } | null;
    } | null;
  } | null;
};

type OutlineRecovery = {
  jobId: string;
  message: string;
};

type AssessmentType =
  | 'ASSIGNMENT'
  | 'QUIZ'
  | 'PROJECT'
  | 'PRESENTATION'
  | 'MIDTERM'
  | 'FINAL'
  | 'PARTICIPATION'
  | 'OTHER';

type AssessmentScoreMode = 'POINTS' | 'PERCENTAGE';

type ClassStatisticsDraft = {
  mean: string;
  median: string;
  standardDeviation: string;
};

type Assessment = {
  id: string;
  activeSelectionId: string;
  courseOfferingId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  assessmentType: AssessmentType;
  weightPercentage: number | null;
  effectiveWeightPercentage: number | null;
  weightIsDerived: boolean;
  pointsPossible: number | null;
  score: {
    id: string;
    pointsEarned: number | null;
    percentage: number | null;
    recordedAt: string;
    sourceType: string;
  } | null;
  classStatistics: {
    mean: number;
    median: number | null;
    standardDeviation: number | null;
    minimum: number | null;
    maximum: number | null;
    sourceType: string;
    recordedAt: string;
  } | null;
  dueDate: string | null;
  datePrecision: 'EXACT' | 'UNKNOWN';
  status: string;
  workStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
  progressPercentage: number | null;
  estimatedEffortHours: number | null;
  effortConfidence: number | null;
  effortSource: 'PERSONAL_ESTIMATE' | 'OUTLINE_ESTIMATE' | 'GENERIC_DEFAULT' | 'UNKNOWN';
  personalEffortHours: number | null;
  isGroupAssessment: boolean;
  sourceType: string;
  sourceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
};

type GradeSummary = {
  courseOfferingId: string;
  courseCode: string;
  courseTitle: string;
  gradingMode: string;
  totalExpectedWeight: number;
  assessmentCount: number;
  gradedAssessmentCount: number;
  weightedPointsEarned: number | null;
  gradedWeight: number | null;
  remainingWeight: number | null;
  currentPerformance: number | null;
  currentGrade: string | null;
  targetAnalyses: Array<{
    target: string;
    threshold: number;
    requiredRemainingAverage: number | null;
    reachable: boolean;
    secured: boolean;
  }>;
  categories: Array<{
    categoryId: string;
    name: string;
    weightPercentage: number;
    aggregationRule: string;
    ruleParameterN: number | null;
    gradedAssessmentCount: number;
    assessmentCount: number;
    droppedAssessmentCount: number;
  }>;
  relativeStatistics: Array<{
    assessmentId: string;
    title: string;
    score: number;
    mean: number;
    median: number | null;
    standardDeviation: number | null;
    minimum: number | null;
    maximum: number | null;
    differenceFromMean: number;
    zScore: number | null;
  }>;
  remainingAssessments: Array<{
    assessmentId: string;
    title: string;
    assessmentType: string;
    dueDate: string | null;
    datePrecision: string;
    weightPercentage: number | null;
    status: string;
  }>;
  warnings: string[];
};
type AssessmentDraft = {
  activeSelectionId: string;
  title: string;
  assessmentType: AssessmentType;
  weightPercentage: string;
  dueDate: string;
  progressPercentage: string;
  personalEffortHours: string;
};

type WorkloadCalculation = {
  id: string;
  courseId: string;
  courseCode: string | null;
  courseTitle: string | null;
  title: string;
  type: AssessmentType;
  dueAt: string | null;
  preparationStart: string | null;
  preparationDays: number;
  remainingEffortHours: number | null;
  estimatedEffortHours: number | null;
  effortSource: 'PERSONAL_ESTIMATE' | 'OUTLINE_ESTIMATE' | 'GENERIC_DEFAULT' | 'UNKNOWN';
  effortConfidence: number;
  importance: number | null;
  urgency: number | null;
  deadlineCompression: number | null;
  overlapCount: number;
  taskPressure: number | null;
  isMajor: boolean;
  status: string;
};

type DailyPressure = {
  date: string;
  pressure: number;
  band: 'LIGHT' | 'MANAGEABLE' | 'MODERATE' | 'HIGH' | 'SEVERE';
  estimatedDemandHours: number | null;
  drivers: string[];
};

type PressureDriverDetails = {
  id: string;
  kind: 'ASSESSMENT' | 'COMMITMENT' | 'UNKNOWN';
  label: string;
  courseCode: string | null;
};

type WeeklyPressure = {
  weekStart: string;
  weekEnd: string;
  pressure: number;
  band: 'LIGHT' | 'MANAGEABLE' | 'MODERATE' | 'HIGH' | 'SEVERE';
  estimatedDemandHours: number | null;
  majorAssessmentCount: number;
  uniqueCourseCount: number;
  drivers: string[];
  driverDetails: PressureDriverDetails[];
};

type PressurePeak = {
  weekStart: string;
  weekEnd: string;
  pressure: number;
  band: WeeklyPressure['band'];
  drivers: string[];
  driverDetails: PressureDriverDetails[];
};

type PressureFinding = {
  type: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  messageKey: string;
  windowStart: string | null;
  windowEnd: string | null;
  pressure: number | null;
  assessmentIds: string[];
  commitmentIds: string[];
};

type Workload = {
  engineVersion: string;
  asOf: string;
  confidence: number;
  completeness: number;
  currentDayPressure: DailyPressure | null;
  dailyPressure: DailyPressure[];
  currentWeekPressure: WeeklyPressure | null;
  weeklyPressure: WeeklyPressure[];
  peakPeriods: PressurePeak[];
  findings: PressureFinding[];
  assessments: WorkloadCalculation[];
  summary: {
    assessmentCount: number;
    datedAssessmentCount: number;
    unknownDateCount: number;
    remainingEffortHours: number;
    overlappingAssessmentCount: number;
    commitmentOccurrenceCount: number;
    commitmentPressure: number;
  };
};

type Meeting = {
  day: string;
  startTime: string;
  endTime: string;
  type: string;
  location: string | null;
};

type CatalogueCourse = {
  id: string;
  courseCode: string;
  title: string;
  description: string | null;
  department: string | null;
  credits: number;
  term: string;
  sections: Array<{
    id: string;
    sectionCode: string;
    capacity: number | null;
    instructor: string | null;
    meetings: Meeting[];
  }>;
};

type Workspace = {
  id: string;
  state: string;
  lockedCandidateSemesterId: string | null;
  lockedAt: string | null;
  term: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    university: { id: string; name: string; shortName: string };
  };
  preferences: Preferences | null;
  coursePreferences: CoursePreference[];
  workloadProfiles: Array<{
    id: string;
    courseOfferingId: string;
    sectionId: string | null;
    source: string;
  }>;
  commitments: Commitment[];
  candidates: Candidate[];
  activeCourseSelections: ActiveCourseSelection[];
};

type CoursePreference = {
  id: string;
  courseOfferingId: string;
  interestScore: number | null;
  careerRelevanceScore: number | null;
  manualDifficultyEstimate: number | null;
  manualNotes: string | null;
};

type Preferences = {
  id: string;
  updatedAt: string;
  workloadPriority: number;
  schedulePriority: number;
  careerPriority: number;
  interestPriority: number;
  gradeSafetyPriority: number;
  projectPreference: number;
  examPreference: number;
  continuousAssessmentPreference: number;
  freeDayPriority: number;
  earlyClassAversion: number;
  lateClassAversion: number;
  maxPreferredHardCourses: number | null;
};

type PreferenceDraft = Omit<Preferences, 'id' | 'updatedAt'>;

type Commitment = {
  id: string;
  name: string;
  category: string;
  weeklyEffortHours: number;
  flexibility: string;
  meetings: Meeting[];
  events: CommitmentEvent[];
};

type CommitmentEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  estimatedEffortHours: number | null;
  flexibilityOverride: CommitmentFlexibility | null;
};

type CommitmentCategory =
  'TASHIP' | 'SOCIETY' | 'WORK' | 'RESEARCH' | 'GYM' | 'COMMUTE' | 'PERSONAL' | 'OTHER';
type CommitmentFlexibility = 'HARD' | 'SOFT' | 'FLEXIBLE';
type CommitmentDraftMeeting = { dayOfWeek: string; startTime: string; endTime: string };
type CommitmentDraft = {
  id?: string;
  name: string;
  category: CommitmentCategory;
  weeklyEffortHours: string;
  flexibility: CommitmentFlexibility;
  meetings: CommitmentDraftMeeting[];
};

type CommitmentEventDraft = {
  id?: string;
  commitmentId: string;
  title: string;
  startAt: string;
  endAt: string;
  estimatedEffortHours: string;
  flexibilityOverride: CommitmentFlexibility | 'INHERIT';
};

type University = {
  id: string;
  name: string;
  shortName: string;
  terms: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
};

const scheduleDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const scheduleStartMinutes = 8 * 60;
const scheduleEndMinutes = 21 * 60;
const scheduleAxisHours = [8, 10, 12, 14, 16, 18, 20, 21];
const commitmentCategories: Array<{ value: CommitmentCategory; label: string }> = [
  { value: 'TASHIP', label: 'TAship' },
  { value: 'SOCIETY', label: 'Society' },
  { value: 'WORK', label: 'Work' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'GYM', label: 'Gym' },
  { value: 'COMMUTE', label: 'Commute' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'OTHER', label: 'Other' },
];
const commitmentDays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];
const preferenceChoices = [
  { value: 0, label: 'Low' },
  { value: 0.5, label: 'Medium' },
  { value: 1, label: 'High' },
];
const workloadProfileFields: Array<[WorkloadDimension, string]> = [
  ['overallIntensity', 'Overall intensity'],
  ['continuousWorkload', 'Continuous workload'],
  ['assignmentIntensity', 'Assignment intensity'],
  ['quizIntensity', 'Quiz intensity'],
  ['projectIntensity', 'Project intensity'],
  ['examIntensity', 'Exam intensity'],
  ['labIntensity', 'Lab intensity'],
  ['readingIntensity', 'Reading intensity'],
  ['scheduleBurden', 'Schedule burden'],
  ['assessmentFragmentation', 'Assessment fragmentation'],
];

function defaultPreferenceDraft(): PreferenceDraft {
  return {
    workloadPriority: 0.5,
    schedulePriority: 0.5,
    careerPriority: 0.5,
    interestPriority: 0.5,
    gradeSafetyPriority: 0.5,
    projectPreference: 0.5,
    examPreference: 0.5,
    continuousAssessmentPreference: 0.5,
    freeDayPriority: 0.5,
    earlyClassAversion: 0.5,
    lateClassAversion: 0.5,
    maxPreferredHardCourses: null,
  };
}

function preferenceDraftFrom(preferences: Preferences | null): PreferenceDraft {
  if (!preferences) return defaultPreferenceDraft();
  const { id: _id, updatedAt: _updatedAt, ...draft } = preferences;
  return draft;
}

function emptyCommitmentDraft(): CommitmentDraft {
  return {
    name: '',
    category: 'PERSONAL',
    weeklyEffortHours: '0',
    flexibility: 'FLEXIBLE',
    meetings: [],
  };
}

function emptyCommitmentEventDraft(commitmentId = ''): CommitmentEventDraft {
  return {
    commitmentId,
    title: '',
    startAt: '',
    endAt: '',
    estimatedEffortHours: '',
    flexibilityOverride: 'INHERIT',
  };
}

function dateTimeInputFromIso(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function timeToMinutes(value: string) {
  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText ?? 0);
  const minutes = Number(minutesText ?? 0);
  return hours * 60 + minutes;
}

function scheduleBlockStyle(meeting: Meeting) {
  const start = Math.max(scheduleStartMinutes, timeToMinutes(meeting.startTime));
  const end = Math.min(scheduleEndMinutes, timeToMinutes(meeting.endTime));
  const total = scheduleEndMinutes - scheduleStartMinutes;
  return {
    top: `${((start - scheduleStartMinutes) / total) * 100}%`,
    height: `${Math.max(((end - start) / total) * 100, 3)}%`,
  };
}

type ScheduleEntry = {
  key: string;
  kind: 'course' | 'commitment';
  sourceId: string;
  label: string;
  detail: string;
  meeting: Meeting;
};

function formatMeeting(meeting: Meeting) {
  const day = meeting.day.slice(0, 3);
  return `${day} ${meeting.startTime}–${meeting.endTime}`;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  if (!remainingMinutes) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatPreferenceFit(value: number | null) {
  return value === null ? 'Not rated' : `${Math.round(value * 100)}%`;
}

function formatPenalty(value: number) {
  return value === 0 ? 'None' : `+${value.toFixed(1)}`;
}

function formatMetric(value: number | null) {
  return value === null ? 'Unknown' : `${value.toFixed(1)}/10`;
}

const candidateMetricExplanations: Record<keyof CandidateAnalysis['metrics'], string> = {
  academicIntensity:
    'A combined signal of the candidate’s modeled academic demand across its known workload dimensions.',
  continuousLoad:
    'The ongoing assignment, quiz, lab, and other continuous-assessment demand across selected courses.',
  projectLoad: 'The modeled concentration of project-based work across selected courses.',
  examLoad: 'The modeled concentration of exam-based work across selected courses.',
  assessmentFragmentation:
    'How spread out and numerous the candidate’s assessment demands are across the semester.',
  scheduleQuality:
    'How compact and usable the fixed timetable is, including gaps, long spans, and free days.',
  commitmentCompatibility:
    'How well fixed course meetings fit around the commitments configured for this candidate.',
  interestFit: 'The average fit with the interest ratings you provided for selected courses.',
  careerFit: 'The average fit with the career-relevance ratings you provided for selected courses.',
  balance:
    'A combined signal of how workload, schedule, commitments, and course preferences balance together.',
  analysisConfidence:
    'How confidently the engine can estimate this candidate from the available structured inputs.',
  dataCompleteness:
    'How much of the candidate’s workload and schedule information is known rather than missing.',
};

function CandidateMetricExplanation({ metric }: { metric: keyof CandidateAnalysis['metrics'] }) {
  return (
    <details className="candidate-metric-help">
      <summary>Why?</summary>
      <p>{candidateMetricExplanations[metric]}</p>
    </details>
  );
}

function formatPercent(value: number) {
  return String(Math.round(value * 100)) + '%';
}

function formatAssessmentWeight(value: number | null) {
  if (value === null) return 'Weight unknown';
  return value.toFixed(2).replace(/\.?(0+)$/, '') + '%';
}

function formatPressureDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatPressureRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const month = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    timeZone: 'UTC',
  }).format(startDate);
  const endMonth = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    timeZone: 'UTC',
  }).format(endDate);
  const startDay = startDate.getUTCDate();
  const endDay = endDate.getUTCDate();
  return month === endMonth
    ? `${month} ${startDay}–${endDay}`
    : `${month} ${startDay}–${endMonth} ${endDay}`;
}

function nextWeekPressure(workload: Workload | undefined) {
  const currentWeek = workload?.currentWeekPressure;
  return currentWeek
    ? workload.weeklyPressure.find((week) => week.weekStart > currentWeek.weekStart)
    : undefined;
}

const pressureFindingTitles: Record<string, string> = {
  UPCOMING_PRESSURE_SPIKE: 'Upcoming pressure spike',
  ASSESSMENT_CLUSTER: 'Assessment cluster',
  MAJOR_DEADLINE_OVERLAP: 'Major deadline overlap',
  DEADLINE_COMPRESSION: 'Deadline compression',
  COMMITMENT_COLLISION: 'Commitment collision',
  EARLY_START_OPPORTUNITY: 'Early-start opportunity',
  UNKNOWN_DATES_REDUCE_CONFIDENCE: 'Unknown dates reduce confidence',
};

const pressureSeverityRank: Record<PressureFinding['severity'], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

function pressureFindingTitle(type: string) {
  return pressureFindingTitles[type] ?? 'Pressure observation';
}

function pressureFindingDescription(finding: PressureFinding, workload: Workload) {
  const assessmentTitles = finding.assessmentIds
    .map((id) => workload.assessments.find((assessment) => assessment.id === id)?.title)
    .filter((title): title is string => Boolean(title));
  const assessmentSubject = assessmentTitles.length
    ? assessmentTitles.join(', ')
    : `${finding.assessmentIds.length} assessment${finding.assessmentIds.length === 1 ? '' : 's'}`;
  const window =
    finding.windowStart && finding.windowEnd
      ? `Window: ${formatPressureRange(finding.windowStart, finding.windowEnd)}.`
      : 'The affected dates are not fully known.';
  const pressure =
    finding.pressure === null ? '' : ` Modeled pressure: ${finding.pressure.toFixed(1)}.`;

  switch (finding.messageKey) {
    case 'upcoming_pressure_spike':
      return `${window}${pressure} ${assessmentSubject} and other demand make this period unusually heavy.`;
    case 'assessment_cluster':
      return `${assessmentSubject} fall within the same deadline cluster. ${window}`;
    case 'major_deadline_overlap':
      return `${assessmentSubject} have major deadlines close together. ${window}`;
    case 'deadline_compression':
      return `${assessmentSubject} has limited time left for its remaining effort. ${window}`;
    case 'commitment_collision':
      return `${assessmentSubject} overlap${assessmentSubject.includes(',') ? '' : 's'} a commitment window. ${window}`;
    case 'early_start_opportunity':
      return `Starting ${assessmentSubject.toLowerCase()} early could reduce deadline pressure. ${window}`;
    case 'unknown_dates_reduce_confidence':
      return `${finding.assessmentIds.length} assessment${finding.assessmentIds.length === 1 ? '' : 's'} lack precise dates, so future pressure is less complete.`;
    default:
      return `${window}${pressure}`;
  }
}

function findingTitle(type: string) {
  const titles: Record<string, string> = {
    TIMETABLE_CLASH: 'Timetable clash',
    COMMITMENT_CLASH: 'Hard commitment clash',
    SOFT_COMMITMENT_PRESSURE: 'Soft commitment pressure',
    CONSTRAINT_VIOLATION: 'Candidate constraint violation',
    PROJECT_CONCENTRATION: 'Project concentration',
    CONTINUOUS_ASSESSMENT_CONCENTRATION: 'Continuous assessment concentration',
    HIGH_EXAM_CONCENTRATION: 'Exam concentration',
    LONG_CAMPUS_DAY: 'Long campus day',
    FREE_DAY: 'Free day',
    EARLY_CLASS_PATTERN: 'Early class pattern',
    LATE_CLASS_PATTERN: 'Late class pattern',
    HEAVY_FIXED_COMMITMENTS: 'Heavy fixed commitments',
    LOW_DATA_COMPLETENESS: 'Low data completeness',
  };
  return titles[type] ?? 'Semester observation';
}

function findingDescription(finding: CandidateFinding, selections: Selection[]) {
  const courseCodes = finding.relatedCourseIds
    .map((id) => selections.find((selection) => selection.id === id)?.courseCode)
    .filter((code): code is string => Boolean(code));
  const courseSuffix = courseCodes.length ? ` (${courseCodes.join(', ')})` : '';

  switch (finding.type) {
    case 'TIMETABLE_CLASH':
      return `Selected course meetings overlap${courseSuffix}.`;
    case 'COMMITMENT_CLASH':
      return `A selected course overlaps a hard commitment${courseSuffix}.`;
    case 'SOFT_COMMITMENT_PRESSURE':
      return `${formatMinutes(finding.totalMinutes ?? 0)} of selected class time overlaps a soft commitment${courseSuffix}.`;
    case 'CONSTRAINT_VIOLATION': {
      const constraintDescriptions: Record<string, string> = {
        DUPLICATE_COURSE: `More than one section of the same course is selected${courseSuffix}.`,
        MINIMUM_CREDITS: `This option has ${finding.actualValue ?? 'fewer'} credits; at least ${finding.expectedValue ?? 'more'} are required.`,
        MAXIMUM_CREDITS: `This option has ${finding.actualValue ?? 'too many'} credits; the limit is ${finding.expectedValue ?? 'lower'}.`,
        REQUIRED_FREE_DAY: `${finding.dayOfWeek ? formatDay(finding.dayOfWeek) : 'A required day'} is not free${courseSuffix}.`,
        EARLIEST_CLASS_TIME: `A class starts at ${finding.actualValue ?? 'an earlier time'}, before the ${finding.expectedValue ?? 'configured'} limit${courseSuffix}.`,
        LATEST_CLASS_TIME: `A class ends at ${finding.actualValue ?? 'a later time'}, after the ${finding.expectedValue ?? 'configured'} limit${courseSuffix}.`,
      };
      return (
        constraintDescriptions[finding.constraintType ?? ''] ??
        'A configured candidate constraint is not satisfied.'
      );
    }
    case 'PROJECT_CONCENTRATION':
      return `${finding.heavyCourseCount ?? courseCodes.length} selected courses appear project-heavy${courseSuffix}.`;
    case 'CONTINUOUS_ASSESSMENT_CONCENTRATION':
      return `${finding.heavyCourseCount ?? courseCodes.length} selected courses appear continuous-assessment-heavy${courseSuffix}.`;
    case 'HIGH_EXAM_CONCENTRATION':
      return `${finding.heavyCourseCount ?? courseCodes.length} selected courses appear exam-heavy${courseSuffix}.`;
    case 'LONG_CAMPUS_DAY':
      return `${finding.dayOfWeek ? formatDay(finding.dayOfWeek) : 'One day'} spans ${formatMinutes(finding.campusSpanMinutes ?? 0)} across campus.`;
    case 'FREE_DAY':
      return `No selected classes fall on ${finding.days?.map(formatDay).join(', ') ?? 'one or more days'}.`;
    case 'EARLY_CLASS_PATTERN':
      return `${formatMinutes(finding.totalMinutes ?? 0)} of class time begins before 09:00.`;
    case 'LATE_CLASS_PATTERN':
      return `${formatMinutes(finding.totalMinutes ?? 0)} of class time continues after 18:00.`;
    case 'HEAVY_FIXED_COMMITMENTS':
      return `${finding.fixedHours?.toFixed(1) ?? 'Several'} fixed commitment hours are already allocated each week.`;
    case 'LOW_DATA_COMPLETENESS':
      return `Only ${formatPercent(finding.dataCompleteness ?? 0)} of the current analysis inputs are complete.`;
    default:
      return 'This option contains a structured observation from the current analysis inputs.';
  }
}

function recommendationTagTitle(tag: string) {
  const labels: Record<string, string> = {
    MOST_BALANCED: 'Most balanced',
    BEST_SCHEDULE: 'Best schedule',
    LOWEST_WORKLOAD: 'Lowest workload',
    BEST_CAREER_FIT: 'Best career fit',
    LOWEST_PROJECT_LOAD: 'Lowest project load',
    BEST_MATCH_FOR_PREFERENCES: 'Best match for you',
  };
  return labels[tag] ?? 'Preference match';
}

function comparisonMetricValue(metric: CandidateComparisonMetricKey, value: number | null) {
  if (value === null) return 'Unknown';
  return metric === 'analysisConfidence' || metric === 'dataCompleteness'
    ? formatPercent(value)
    : formatMetric(value);
}

function comparisonTradeoffText(
  tradeoff: CandidateComparison['tradeoffs'][number],
  comparison: CandidateComparison,
) {
  const better = comparison.candidates.find(
    (candidate) => candidate.candidateId === tradeoff.betterCandidateId,
  )?.name;
  const worse = comparison.candidates.find(
    (candidate) => candidate.candidateId === tradeoff.worseCandidateId,
  )?.name;
  const metric = comparison.metricDifferences.find((item) => item.metric === tradeoff.metric);
  if (!better || !worse || !metric) return 'This comparison contains a meaningful trade-off.';
  const formattedDelta =
    tradeoff.metric === 'analysisConfidence' || tradeoff.metric === 'dataCompleteness'
      ? `${Math.round(tradeoff.delta * 100)} percentage points`
      : `${tradeoff.delta.toFixed(1)} points`;
  return `${better} has ${formattedDelta} ${metric.lowerIsBetter ? 'lower' : 'higher'} ${metric.label.toLowerCase()} than ${worse}.`;
}

function formatDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

function formatDayList(days: string[]) {
  return days.length ? days.map(formatDay).join(', ') : 'None';
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    if (response.status === 401) throw new Error('Please sign in again.');
    if (body?.error === 'VALIDATION_ERROR') throw new Error('Check the highlighted information.');
    if (body?.error === 'COURSE_ALREADY_SELECTED') {
      throw new Error('This candidate already includes that course. Choose a different section.');
    }
    if (body?.error === 'SECTION_MUST_MATCH_COURSE') {
      throw new Error('Choose another section of the same course when switching sections.');
    }
    if (body?.error === 'CANDIDATE_HAS_CRITICAL_CONFLICTS') {
      throw new Error('This change would create a critical timetable conflict.');
    }
    if (body?.error === 'CANDIDATE_EMPTY') {
      throw new Error('Add at least one course before locking this semester.');
    }
    if (body?.error === 'WORKSPACE_ALREADY_ACTIVE') {
      throw new Error('This semester is already active.');
    }
    if (body?.error === 'CANDIDATE_ARCHIVED') {
      throw new Error('Archived candidates cannot be locked.');
    }
    if (body?.error === 'WORKSPACE_NOT_ACTIVE') {
      throw new Error('Lock the semester before changing active courses.');
    }
    if (body?.error === 'COURSE_ALREADY_ACTIVE') {
      throw new Error('That course is already active in this semester.');
    }
    if (body?.error === 'ACTIVE_SELECTION_NOT_FOUND') {
      throw new Error('That active course is no longer available. Refresh and try again.');
    }
    if (body?.error === 'ASSESSMENT_NOT_FOUND') {
      throw new Error('That assessment is no longer available. Refresh and try again.');
    }
    if (body?.error === 'ASSESSMENT_CANCELLED') {
      throw new Error('Cancelled assessments cannot be edited.');
    }
    if (body?.error === 'COMMITMENT_NOT_FOUND') {
      throw new Error('That commitment is no longer available. Refresh and try again.');
    }
    if (body?.error === 'COMMITMENT_EVENT_NOT_FOUND') {
      throw new Error('That one-off event is no longer available. Refresh and try again.');
    }
    throw new Error('Semora could not save this change. Please try again.');
  }
  return response.json() as Promise<T>;
}

export function PlanningLandingPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>();
  const [universities, setUniversities] = useState<University[]>();
  const [academicTermId, setAcademicTermId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      apiRequest<{ workspaces: Workspace[] }>('/api/workspaces'),
      apiRequest<{ universities: University[] }>('/api/terms'),
    ])
      .then(([workspaceResult, termResult]) => {
        if (!isCurrent) return;
        setWorkspaces(workspaceResult.workspaces);
        setUniversities(termResult.universities);
        setAcademicTermId(termResult.universities[0]?.terms[0]?.id ?? '');
      })
      .catch((reason: unknown) => {
        if (isCurrent)
          setError(reason instanceof Error ? reason.message : 'Unable to load semester setup.');
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (createdWorkspaceId) return <Navigate replace to={`/plan/${createdWorkspaceId}`} />;
  if (workspaces?.[0]) return <Navigate replace to={`/plan/${workspaces[0].id}`} />;

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      const result = await apiRequest<{ workspace: Workspace }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ academicTermId }),
      });
      setCreatedWorkspaceId(result.workspace.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create your workspace.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const termOptions =
    universities?.flatMap((university) =>
      university.terms.map((term) => ({
        id: term.id,
        label: `${university.shortName} · ${term.name}`,
      })),
    ) ?? [];

  return (
    <main className="setup-shell">
      <section className="setup-panel" aria-labelledby="setup-title">
        <p className="eyebrow">PLAN / SEMESTER SETUP</p>
        <h1 id="setup-title">Start with the semester you’re designing.</h1>
        <p className="lede">
          Choose a university and academic term. Preferences and commitments can be added as your
          plan takes shape.
        </p>
        {!universities && !error ? (
          <LoadingState eyebrow="PLAN / SEMESTER SETUP" label="Loading available terms…" />
        ) : null}
        {error ? (
          <PageState
            eyebrow="PLAN / SEMESTER SETUP"
            message={error}
            title="Semester setup is temporarily unavailable."
            tone="error"
          />
        ) : null}
        {universities && !termOptions.length ? (
          <PageState
            eyebrow="PLAN / SEMESTER SETUP"
            message="No university terms are available yet. Try again later or ask an administrator to load the catalogue."
            title="No semesters are available."
          />
        ) : null}
        {universities && termOptions.length ? (
          <form className="setup-form" onSubmit={createWorkspace}>
            <label htmlFor="academic-term">University and academic term</label>
            <select
              id="academic-term"
              onChange={(event) => setAcademicTermId(event.target.value)}
              required
              value={academicTermId}
            >
              {termOptions.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.label}
                </option>
              ))}
            </select>
            <button disabled={isSubmitting || !academicTermId} type="submit">
              {isSubmitting ? 'Creating workspace…' : 'Begin planning'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

export function PlanningPage() {
  const { workspaceId } = useParams();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>();
  const [newCandidateName, setNewCandidateName] = useState('');
  const [editedName, setEditedName] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [appliedCourseSearch, setAppliedCourseSearch] = useState('');
  const [catalogueCourses, setCatalogueCourses] = useState<CatalogueCourse[]>([]);
  const [isCatalogueLoading, setIsCatalogueLoading] = useState(false);
  const [activeOfferingId, setActiveOfferingId] = useState<string>();
  const [candidateValidation, setCandidateValidation] = useState<CandidateValidation>();
  const [candidateAnalysis, setCandidateAnalysis] = useState<CandidateAnalysis>();
  const [candidateComparison, setCandidateComparison] = useState<CandidateComparison>();
  const [scenarioAnalysis, setScenarioAnalysis] = useState<CandidateAnalysis>();
  const [scenarioDescription, setScenarioDescription] = useState<string>();
  const [validationRefresh, setValidationRefresh] = useState(0);
  const [commitmentDraft, setCommitmentDraft] = useState<CommitmentDraft>(emptyCommitmentDraft);
  const [commitmentEventDraft, setCommitmentEventDraft] = useState<CommitmentEventDraft>(
    emptyCommitmentEventDraft(),
  );
  const [preferenceDraft, setPreferenceDraft] = useState<PreferenceDraft>(defaultPreferenceDraft);
  const [busyAction, setBusyAction] = useState<string>();
  const [error, setError] = useState<string>();
  const [commitmentFormError, setCommitmentFormError] = useState<string>();

  async function loadWorkspace() {
    if (!workspaceId) return;
    const result = await apiRequest<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`);
    setWorkspace(result.workspace);
    setCandidateValidation(undefined);
    setCandidateComparison(undefined);
    setSelectedCandidateId((current) =>
      result.workspace.candidates.some((candidate) => candidate.id === current)
        ? current
        : result.workspace.candidates[0]?.id,
    );
  }

  useEffect(() => {
    setError(undefined);
    loadWorkspace().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Unable to load this workspace.'),
    );
  }, [workspaceId]);

  const selectedCandidate = workspace?.candidates.find(
    (candidate) => candidate.id === selectedCandidateId,
  );
  const lockedCandidate = workspace?.candidates.find(
    (candidate) => candidate.id === workspace?.lockedCandidateSemesterId,
  );

  useEffect(() => {
    setEditedName(selectedCandidate?.name ?? '');
  }, [selectedCandidate?.id, selectedCandidate?.name]);

  useEffect(() => {
    setPreferenceDraft(preferenceDraftFrom(workspace?.preferences ?? null));
  }, [workspace?.preferences?.updatedAt]);

  useEffect(() => {
    const defaultCommitmentId = workspace?.commitments[0]?.id ?? '';
    if (
      commitmentEventDraft.commitmentId &&
      workspace?.commitments.some(
        (commitment) => commitment.id === commitmentEventDraft.commitmentId,
      )
    ) {
      return;
    }
    if (commitmentEventDraft.commitmentId === defaultCommitmentId) return;
    setCommitmentEventDraft((current) => ({
      ...current,
      commitmentId: defaultCommitmentId,
    }));
  }, [workspace?.commitments, commitmentEventDraft.commitmentId]);

  useEffect(() => {
    if (!selectedCandidateId) {
      setCandidateValidation(undefined);
      setCandidateAnalysis(undefined);
      setScenarioAnalysis(undefined);
      setScenarioDescription(undefined);
      return;
    }
    let isCurrent = true;
    Promise.all([
      apiRequest<CandidateValidation>(`/api/candidates/${selectedCandidateId}/validation`),
      apiRequest<CandidateAnalysis>(`/api/candidates/${selectedCandidateId}/analysis`),
    ])
      .then(([validation, analysis]) => {
        if (!isCurrent) return;
        setCandidateValidation(validation);
        setCandidateAnalysis(analysis);
        setScenarioAnalysis(undefined);
        setScenarioDescription(undefined);
      })
      .catch((reason: unknown) => {
        if (isCurrent)
          setError(reason instanceof Error ? reason.message : 'Unable to validate this timetable.');
      });
    return () => {
      isCurrent = false;
    };
  }, [selectedCandidateId, validationRefresh]);

  useEffect(() => {
    if (!workspaceId || !workspace || workspace.candidates.length < 2) {
      setCandidateComparison(undefined);
      return;
    }
    let isCurrent = true;
    apiRequest<CandidateComparison>(`/api/workspaces/${workspaceId}/comparison`)
      .then((comparison) => {
        if (isCurrent) setCandidateComparison(comparison);
      })
      .catch((reason: unknown) => {
        if (isCurrent) {
          setError(reason instanceof Error ? reason.message : 'Unable to compare candidates.');
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [workspace, workspaceId, validationRefresh]);

  useEffect(() => {
    if (!workspace || !appliedCourseSearch) {
      setCatalogueCourses([]);
      setIsCatalogueLoading(false);
      return;
    }
    let isCurrent = true;
    setIsCatalogueLoading(true);
    apiRequest<{ courses: CatalogueCourse[] }>(
      `/api/catalogue?termId=${encodeURIComponent(workspace.term.id)}&q=${encodeURIComponent(appliedCourseSearch)}`,
    )
      .then((result) => {
        if (!isCurrent) return;
        setCatalogueCourses(result.courses);
      })
      .catch((reason: unknown) => {
        if (isCurrent)
          setError(reason instanceof Error ? reason.message : 'Unable to search courses.');
      })
      .finally(() => {
        if (isCurrent) setIsCatalogueLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [appliedCourseSearch, workspace?.term.name]);

  async function runMutation(action: string, mutation: () => Promise<unknown>) {
    setError(undefined);
    setBusyAction(action);
    try {
      await mutation();
      await loadWorkspace();
      setValidationRefresh((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this change.');
    } finally {
      setBusyAction(undefined);
    }
  }

  async function runScenario(body: Record<string, unknown>, description: string) {
    if (!selectedCandidate) return;
    setError(undefined);
    setBusyAction('scenario');
    try {
      const result = await apiRequest<{ analysis: CandidateAnalysis }>(
        `/api/candidates/${selectedCandidate.id}/scenario`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      setScenarioAnalysis(result.analysis);
      setScenarioDescription(description);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to explore this scenario.');
    } finally {
      setBusyAction(undefined);
    }
  }

  function exploreSection(sectionId: string) {
    if (!activeOffering) return;
    const existing = activeSelection;
    void runScenario(
      existing
        ? { replaceSelection: { selectionId: existing.id, sectionId } }
        : { addSectionId: sectionId },
      existing
        ? `Try ${activeOffering.courseCode} with another section`
        : `Try adding ${activeOffering.courseCode}`,
    );
  }

  function exploreRemoveCourse(selection: Selection) {
    void runScenario(
      { removeSelectionId: selection.id },
      `Try the semester without ${selection.courseCode}`,
    );
  }

  function exploreRemoveCommitment(commitment: Commitment) {
    void runScenario(
      { removeCommitmentId: commitment.id },
      `Try the semester without ${commitment.name}`,
    );
  }

  function exploreWorkloadPriority(value: number) {
    void runScenario(
      { preferences: { workloadPriority: value } },
      `Try workload priority at ${value === 1 ? 'high' : value === 0 ? 'low' : 'medium'}`,
    );
  }

  function createCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCandidateName.trim();
    if (!workspaceId || !name) return;
    void runMutation('create', async () => {
      const result = await apiRequest<{ candidate: Candidate }>(
        `/api/workspaces/${workspaceId}/candidates`,
        { method: 'POST', body: JSON.stringify({ name }) },
      );
      setNewCandidateName('');
      setSelectedCandidateId(result.candidate.id);
    });
  }

  function renameCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCandidate || !editedName.trim()) return;
    void runMutation('rename', () =>
      apiRequest(`/api/candidates/${selectedCandidate.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editedName.trim() }),
      }),
    );
  }

  function lockCandidate() {
    if (!selectedCandidate || workspace?.state !== 'PLANNING') return;
    void runMutation('lock', () =>
      apiRequest(`/api/candidates/${selectedCandidate.id}/lock`, { method: 'POST' }),
    );
  }

  function searchCourses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedCourseSearch(courseSearch.trim());
    setActiveOfferingId(undefined);
  }

  function openOffering(course: CatalogueCourse) {
    setActiveOfferingId(course.id);
  }

  function openSelectedCourse(selection: Selection) {
    setCourseSearch(selection.courseCode);
    setAppliedCourseSearch(selection.courseCode);
    setActiveOfferingId(selection.courseOfferingId);
  }

  function chooseSection(sectionId: string) {
    if (!selectedCandidate || !activeOfferingId) return;
    const existing = selectedCandidate.selections.find(
      (selection) => selection.courseOfferingId === activeOfferingId,
    );
    void runMutation('selection', () =>
      apiRequest(
        existing
          ? `/api/selections/${existing.id}`
          : `/api/candidates/${selectedCandidate.id}/selections`,
        { method: existing ? 'PATCH' : 'POST', body: JSON.stringify({ sectionId }) },
      ),
    ).then(() => setActiveOfferingId(undefined));
  }

  function removeSelection(selectionId: string) {
    void runMutation('remove-selection', () =>
      apiRequest(`/api/selections/${selectionId}`, { method: 'DELETE' }),
    );
  }

  function editCommitment(commitment: Commitment) {
    setCommitmentDraft({
      id: commitment.id,
      name: commitment.name,
      category: commitment.category as CommitmentCategory,
      weeklyEffortHours: String(commitment.weeklyEffortHours),
      flexibility: commitment.flexibility as CommitmentFlexibility,
      meetings: commitment.meetings.map((meeting) => ({
        dayOfWeek: meeting.day,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
      })),
    });
  }

  function updateCommitmentDraft(
    field: 'name' | 'category' | 'weeklyEffortHours' | 'flexibility',
    value: string,
  ) {
    setCommitmentFormError(undefined);
    setCommitmentDraft(
      (current) =>
        ({
          ...current,
          [field]: value,
        }) as CommitmentDraft,
    );
  }

  function updateCommitmentMeeting(
    index: number,
    field: keyof CommitmentDraftMeeting,
    value: string,
  ) {
    setCommitmentFormError(undefined);
    setCommitmentDraft((current) => ({
      ...current,
      meetings: current.meetings.map((meeting, meetingIndex) =>
        meetingIndex === index ? { ...meeting, [field]: value } : meeting,
      ),
    }));
  }

  function addCommitmentMeeting() {
    setCommitmentFormError(undefined);
    setCommitmentDraft((current) => ({
      ...current,
      meetings: [
        ...current.meetings,
        { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00' },
      ],
    }));
  }

  function removeCommitmentMeeting(index: number) {
    setCommitmentFormError(undefined);
    setCommitmentDraft((current) => ({
      ...current,
      meetings: current.meetings.filter((_, meetingIndex) => meetingIndex !== index),
    }));
  }

  function saveCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommitmentFormError(undefined);
    if (!workspaceId || !commitmentDraft.name.trim()) return;
    const invalidMeetingIndex = commitmentDraft.meetings.findIndex(
      (meeting) => meeting.startTime >= meeting.endTime,
    );
    if (invalidMeetingIndex >= 0) {
      setCommitmentFormError(`Recurring time ${invalidMeetingIndex + 1} must end after it starts.`);
      return;
    }
    const payload = {
      name: commitmentDraft.name.trim(),
      category: commitmentDraft.category,
      weeklyEffortHours: Number(commitmentDraft.weeklyEffortHours),
      flexibility: commitmentDraft.flexibility,
      meetings: commitmentDraft.meetings,
    };
    void runMutation('commitment', async () => {
      await apiRequest(
        commitmentDraft.id
          ? `/api/commitments/${commitmentDraft.id}`
          : `/api/workspaces/${workspaceId}/commitments`,
        {
          method: commitmentDraft.id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      setCommitmentDraft(emptyCommitmentDraft());
      setCommitmentFormError(undefined);
    });
  }

  function removeCommitment(commitment: Commitment) {
    if (!window.confirm(`Remove ${commitment.name} from this semester?`)) return;
    void runMutation('delete-commitment', async () => {
      await apiRequest(`/api/commitments/${commitment.id}`, { method: 'DELETE' });
      if (commitmentDraft.id === commitment.id) setCommitmentDraft(emptyCommitmentDraft());
    });
  }

  function editCommitmentEvent(event: CommitmentEvent, commitmentId: string) {
    setCommitmentEventDraft({
      id: event.id,
      commitmentId,
      title: event.title,
      startAt: dateTimeInputFromIso(event.startAt),
      endAt: dateTimeInputFromIso(event.endAt),
      estimatedEffortHours: event.estimatedEffortHours?.toString() ?? '',
      flexibilityOverride: event.flexibilityOverride ?? 'INHERIT',
    });
  }

  function saveCommitmentEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !commitmentEventDraft.commitmentId || !commitmentEventDraft.title.trim()) {
      return;
    }
    const startAt = new Date(commitmentEventDraft.startAt);
    const endAt = new Date(commitmentEventDraft.endAt);
    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      startAt.getTime() >= endAt.getTime()
    ) {
      setError('One-off events must have an end time after their start time.');
      return;
    }
    const effort = commitmentEventDraft.estimatedEffortHours.trim();
    const payload = {
      title: commitmentEventDraft.title.trim(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      estimatedEffortHours: effort ? Number(effort) : null,
      flexibilityOverride:
        commitmentEventDraft.flexibilityOverride === 'INHERIT'
          ? null
          : commitmentEventDraft.flexibilityOverride,
    };
    void runMutation('commitment-event', async () => {
      await apiRequest(
        commitmentEventDraft.id
          ? `/api/commitment-events/${commitmentEventDraft.id}`
          : `/api/commitments/${commitmentEventDraft.commitmentId}/events`,
        {
          method: commitmentEventDraft.id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      setCommitmentEventDraft(emptyCommitmentEventDraft(commitmentEventDraft.commitmentId));
    });
  }

  function removeCommitmentEvent(event: CommitmentEvent) {
    if (!window.confirm(`Remove ${event.title} from this semester?`)) return;
    void runMutation('delete-commitment-event', async () => {
      await apiRequest(`/api/commitment-events/${event.id}`, { method: 'DELETE' });
      if (commitmentEventDraft.id === event.id) {
        setCommitmentEventDraft(emptyCommitmentEventDraft(commitmentEventDraft.commitmentId));
      }
    });
  }

  function updatePreference(field: keyof PreferenceDraft, value: number) {
    setPreferenceDraft((current) => ({ ...current, [field]: value }));
  }

  function assessmentStyle() {
    if (preferenceDraft.projectPreference > preferenceDraft.examPreference + 0.1) {
      return 'PROJECTS';
    }
    if (preferenceDraft.examPreference > preferenceDraft.projectPreference + 0.1) {
      return 'EXAMS';
    }
    return 'BALANCED';
  }

  function updateAssessmentStyle(value: string) {
    const next =
      value === 'PROJECTS'
        ? { projectPreference: 1, examPreference: 0 }
        : value === 'EXAMS'
          ? { projectPreference: 0, examPreference: 1 }
          : { projectPreference: 0.5, examPreference: 0.5 };
    setPreferenceDraft((current) => ({ ...current, ...next }));
  }

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    void runMutation('preferences', async () => {
      const result = await apiRequest<{ preferences: Preferences }>(
        `/api/workspaces/${workspaceId}/preferences`,
        { method: 'PATCH', body: JSON.stringify(preferenceDraft) },
      );
      setPreferenceDraft(preferenceDraftFrom(result.preferences));
    });
  }

  function saveWorkloadProfile(courseOfferingId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const formData = new FormData(event.currentTarget);
    const numericValue = (field: string) => {
      const value = String(formData.get(field) ?? '').trim();
      return value ? Number(value) : null;
    };
    const body = Object.fromEntries([
      ...workloadProfileFields.map(([field]) => [field, numericValue(field)]),
      ['estimatedWeeklyHours', numericValue('estimatedWeeklyHours')],
    ]);
    void runMutation(`workload-profile-${courseOfferingId}`, () =>
      apiRequest(`/api/workspaces/${workspaceId}/workload-profiles/${courseOfferingId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    );
  }

  function resetWorkloadProfile(courseOfferingId: string) {
    if (!workspaceId) return;
    void runMutation(`reset-workload-profile-${courseOfferingId}`, () =>
      apiRequest(`/api/workspaces/${workspaceId}/workload-profiles/${courseOfferingId}`, {
        method: 'DELETE',
      }),
    );
  }

  function saveCoursePreference(courseOfferingId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) return;
    const formData = new FormData(event.currentTarget);
    const preferenceValue = (field: string) => {
      const value = String(formData.get(field) ?? '').trim();
      return value ? Number(value) : null;
    };
    void runMutation(`course-preference-${courseOfferingId}`, () =>
      apiRequest(`/api/workspaces/${workspaceId}/course-preferences/${courseOfferingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          interestScore: preferenceValue('interestScore'),
          careerRelevanceScore: preferenceValue('careerRelevanceScore'),
        }),
      }),
    );
  }

  function resetCoursePreference(courseOfferingId: string) {
    if (!workspaceId) return;
    void runMutation(`reset-course-preference-${courseOfferingId}`, () =>
      apiRequest(`/api/workspaces/${workspaceId}/course-preferences/${courseOfferingId}`, {
        method: 'DELETE',
      }),
    );
  }

  const activeOffering = catalogueCourses.find((course) => course.id === activeOfferingId);
  const activeSelection = selectedCandidate?.selections.find(
    (selection) => selection.courseOfferingId === activeOfferingId,
  );
  const commitmentEvents =
    workspace?.commitments
      .flatMap((commitment) =>
        commitment.events.map((event) => ({
          ...event,
          commitmentName: commitment.name,
          commitmentId: commitment.id,
        })),
      )
      .sort((first, second) => first.startAt.localeCompare(second.startAt)) ?? [];
  const conflictIds = new Set(
    candidateValidation?.clashes.flatMap((clash) => [clash.first.id, clash.second.id]) ?? [],
  );
  const canLock = Boolean(
    workspace?.state === 'PLANNING' &&
    selectedCandidate?.selectionCount &&
    candidateValidation?.candidateId === selectedCandidate?.id &&
    candidateValidation.valid,
  );
  const scheduleEntries: ScheduleEntry[] = [
    ...(selectedCandidate?.selections.flatMap((selection) =>
      selection.meetings.map((meeting, index) => ({
        key: `${selection.id}-${meeting.day}-${index}`,
        kind: 'course' as const,
        sourceId: selection.id,
        label: selection.courseCode,
        detail: `Section ${selection.sectionCode} · ${meeting.startTime}–${meeting.endTime}`,
        meeting,
      })),
    ) ?? []),
    ...(workspace?.commitments.flatMap((commitment) =>
      commitment.meetings.map((meeting, index) => ({
        key: `${commitment.id}-${meeting.day}-${index}`,
        kind: 'commitment' as const,
        sourceId: commitment.id,
        label: commitment.name,
        detail: `${meeting.startTime}–${meeting.endTime}`,
        meeting,
      })),
    ) ?? []),
  ];
  const visibleScheduleEntries = scheduleEntries.filter(
    (entry) =>
      scheduleDays.includes(entry.meeting.day as (typeof scheduleDays)[number]) &&
      timeToMinutes(entry.meeting.endTime) > scheduleStartMinutes &&
      timeToMinutes(entry.meeting.startTime) < scheduleEndMinutes,
  );

  if (!workspace && !error)
    return (
      <main className="app-page">
        <LoadingState eyebrow="PLAN / SEMESTER DESIGNER" label="Loading your semester workspace…" />
      </main>
    );

  if (workspace?.state === 'ACTIVE') {
    return <ActiveSemesterView workspace={workspace} onReload={loadWorkspace} />;
  }

  return (
    <main className="planner-page">
      {workspace ? (
        <>
          <header className="planner-heading">
            <div>
              <p className="eyebrow">PLAN / SEMESTER DESIGNER</p>
              <h1>{workspace.term.name}</h1>
              <p className="lede">{workspace.term.university.name}</p>
            </div>
            <Link className="back-link" to={`/catalogue?termId=${workspace.term.id}`}>
              Browse catalogue
            </Link>
          </header>

          <section className="candidate-strip" aria-label="Candidate semesters">
            <div className="candidate-tabs">
              {workspace.candidates.map((candidate) => (
                <button
                  className={
                    candidate.id === selectedCandidateId ? 'candidate-tab active' : 'candidate-tab'
                  }
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  type="button"
                >
                  {candidate.name}
                </button>
              ))}
            </div>
            <form className="new-candidate-form" onSubmit={createCandidate}>
              <label className="sr-only" htmlFor="candidate-name">
                New option name
              </label>
              <input
                id="candidate-name"
                maxLength={80}
                onChange={(event) => setNewCandidateName(event.target.value)}
                placeholder={workspace.candidates.length ? 'New option name' : 'Option A'}
                value={newCandidateName}
              />
              <button disabled={busyAction === 'create' || !newCandidateName.trim()} type="submit">
                {busyAction === 'create' ? 'Creating…' : '+ New option'}
              </button>
            </form>
          </section>

          {workspace.state === 'ACTIVE' ? (
            <section className="lock-panel locked" aria-labelledby="active-semester-title">
              <div>
                <p className="eyebrow">SEMESTER ACTIVE</p>
                <h2 id="active-semester-title">
                  {lockedCandidate?.name ?? 'Your selected semester'} is now active.
                </h2>
                <p>
                  Planning options remain available. Add/Drop changes will be supported from the
                  active-semester workflow.
                </p>
              </div>
              <span className="lock-status-label">Locked</span>
            </section>
          ) : selectedCandidate ? (
            <section className="lock-panel" aria-labelledby="lock-semester-title">
              <div>
                <p className="eyebrow">READY TO LOCK?</p>
                <h2 id="lock-semester-title">
                  Make {selectedCandidate.name} your active semester.
                </h2>
                <p>
                  Semora will copy these selected sections into your active semester. Your planning
                  options stay available, and Add/Drop changes can be made later.
                </p>
                {!selectedCandidate.selectionCount ? (
                  <p className="lock-help">Add at least one course before locking.</p>
                ) : candidateValidation && !candidateValidation.valid ? (
                  <p className="lock-help">Resolve the critical timetable conflicts above first.</p>
                ) : null}
              </div>
              <button
                disabled={!canLock || Boolean(busyAction)}
                onClick={lockCandidate}
                type="button"
              >
                {busyAction === 'lock' ? 'Locking semester…' : 'Lock Semester'}
              </button>
            </section>
          ) : null}

          {candidateComparison && candidateComparison.candidates.length > 1 ? (
            <section
              className="comparison-panel"
              aria-describedby="comparison-guide"
              aria-labelledby="comparison-title"
            >
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">CANDIDATE COMPARISON</p>
                  <h2 id="comparison-title">Which trade-off fits you?</h2>
                </div>
                <span className="course-meta">Differences under 0.5 stay neutral</span>
              </div>
              <aside className="comparison-guide" id="comparison-guide">
                <strong>How to read this comparison</strong>
                <span>
                  Bold values mark the stronger signal when a difference is meaningful. Lower is
                  lighter for load metrics; higher is better for schedule, fit, balance, confidence,
                  and completeness.
                </span>
                <span>Recommendation tags reflect the priorities saved for this semester.</span>
              </aside>
              <div className="comparison-candidate-grid">
                {candidateComparison.candidates.map((candidate) => {
                  const selections =
                    workspace.candidates.find((item) => item.id === candidate.candidateId)
                      ?.selections ?? [];
                  const meaningfulFindings = candidate.analysis.findings
                    .filter((finding) => finding.severity !== 'INFO')
                    .slice(0, 2);
                  return (
                    <article className="comparison-candidate" key={candidate.candidateId}>
                      <div>
                        <h3>{candidate.name}</h3>
                        <span className="comparison-credit-count">
                          {candidate.analysis.totalCredits} credits
                        </span>
                        <span
                          className={
                            candidate.analysis.validity.valid ? 'valid-label' : 'invalid-label'
                          }
                        >
                          {candidate.analysis.validity.valid
                            ? 'Valid option'
                            : 'Needs constraint fixes'}
                        </span>
                      </div>
                      {candidate.recommendationTags.length ? (
                        <div className="recommendation-tags">
                          {candidate.recommendationTags.map((tag) => (
                            <span className="recommendation-tag" key={tag}>
                              {recommendationTagTitle(tag)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {meaningfulFindings.length ? (
                        <ul className="comparison-findings">
                          {meaningfulFindings.map((finding, index) => (
                            <li key={`${finding.type}-${index}`}>
                              <strong>{findingTitle(finding.type)}</strong>
                              <span>{findingDescription(finding, selections)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              <div className="comparison-table-wrap">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      {candidateComparison.candidates.map((candidate) => (
                        <th scope="col" key={candidate.candidateId}>
                          {candidate.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {candidateComparison.metricDifferences.map((difference) => (
                      <tr
                        className={difference.meaningful ? 'meaningful-difference' : ''}
                        key={difference.metric}
                      >
                        <th scope="row">{difference.label}</th>
                        {candidateComparison.candidates.map((candidate) => {
                          const value =
                            difference.values.find(
                              (entry) => entry.candidateId === candidate.candidateId,
                            )?.value ?? null;
                          const isBetter = difference.betterCandidateIds.includes(
                            candidate.candidateId,
                          );
                          return (
                            <td
                              className={difference.meaningful && isBetter ? 'better-value' : ''}
                              key={candidate.candidateId}
                            >
                              {comparisonMetricValue(difference.metric, value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {candidateComparison.tradeoffs.length ? (
                <div className="comparison-tradeoffs">
                  <p className="eyebrow">KEY TRADE-OFFS</p>
                  <ul>
                    {candidateComparison.tradeoffs.slice(0, 5).map((tradeoff) => (
                      <li key={`${tradeoff.metric}-${tradeoff.betterCandidateId}`}>
                        {comparisonTradeoffText(tradeoff, candidateComparison)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="interaction-pressure-help">
                  These options are currently similar across the known comparison metrics.
                </p>
              )}
            </section>
          ) : null}

          {error ? <p className="form-error planner-error">{error}</p> : null}

          {candidateValidation?.clashes.length ? (
            <aside className="clash-warning" role="alert">
              <p className="eyebrow">HARD CONSTRAINT</p>
              <h2>Schedule conflict detected</h2>
              <p>Resolve these overlaps before treating this candidate as valid.</p>
              <ul>
                {candidateValidation.clashes.map((clash, index) => (
                  <li key={`${clash.type}-${clash.first.id}-${clash.second.id}-${index}`}>
                    <strong>
                      {clash.type === 'COURSE_COURSE'
                        ? 'Course overlap'
                        : 'Hard commitment overlap'}
                    </strong>
                    <span>
                      {clash.dayOfWeek.slice(0, 3)} {clash.startTime}–{clash.endTime} ·{' '}
                      {clash.first.label} ↔ {clash.second.label}
                    </span>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          {candidateAnalysis ? (
            <section className="intelligence-panel" aria-labelledby="schedule-intelligence-title">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">SEMESTER INTELLIGENCE</p>
                  <h2 id="schedule-intelligence-title">The shape of this week</h2>
                </div>
                <span className="course-meta">
                  Preliminary · Engine {candidateAnalysis.engineVersion}
                </span>
              </div>
              <div className="intelligence-summary">
                <article className="intelligence-metric">
                  <span>Class time</span>
                  <strong>{formatMinutes(candidateAnalysis.schedule.totalClassMinutes)}</strong>
                  <small>{candidateAnalysis.schedule.scheduledDays.length} scheduled days</small>
                </article>
                <article className="intelligence-metric">
                  <span>Free days</span>
                  <strong>{candidateAnalysis.schedule.freeDays.length}</strong>
                  <small>{formatDayList(candidateAnalysis.schedule.freeDays)}</small>
                </article>
                <article className="intelligence-metric">
                  <span>Longest campus span</span>
                  <strong>
                    {formatMinutes(candidateAnalysis.schedule.longestCampusSpanMinutes)}
                  </strong>
                  <small>
                    {candidateAnalysis.schedule.longestDay
                      ? formatDay(candidateAnalysis.schedule.longestDay)
                      : 'No classes yet'}
                  </small>
                </article>
                <article className="intelligence-metric">
                  <span>Idle gaps</span>
                  <strong>{formatMinutes(candidateAnalysis.schedule.totalIdleGapMinutes)}</strong>
                  <small>Across separate class blocks</small>
                </article>
              </div>
              <div className="preference-fit-summary">
                <div>
                  <span>Interest fit</span>
                  <strong>
                    {formatPreferenceFit(candidateAnalysis.coursePreferenceFit.interestFit)}
                  </strong>
                  <small>
                    {candidateAnalysis.coursePreferenceFit.interestKnownCount}/
                    {candidateAnalysis.coursePreferenceFit.courseCount} courses rated
                  </small>
                </div>
                <div>
                  <span>Career relevance</span>
                  <strong>
                    {formatPreferenceFit(candidateAnalysis.coursePreferenceFit.careerFit)}
                  </strong>
                  <small>
                    {candidateAnalysis.coursePreferenceFit.careerKnownCount}/
                    {candidateAnalysis.coursePreferenceFit.courseCount} courses rated
                  </small>
                </div>
              </div>
              <section
                className="interaction-pressure-panel"
                aria-labelledby="interaction-pressure-title"
              >
                <div className="interaction-pressure-heading">
                  <div>
                    <p className="eyebrow">COURSE COMPOSITION</p>
                    <h3 id="interaction-pressure-title">Assessment concentration</h3>
                  </div>
                  <span className="course-meta">
                    Total interaction pressure{' '}
                    {formatPenalty(candidateAnalysis.interactionPenalties.totalPenalty)}
                  </span>
                </div>
                <div className="interaction-pressure-grid">
                  <article>
                    <span>Projects</span>
                    <strong>
                      {formatPenalty(
                        candidateAnalysis.interactionPenalties.projectConcentration.penalty,
                      )}
                    </strong>
                    <small>
                      {candidateAnalysis.interactionPenalties.projectConcentration.heavyCourseCount}{' '}
                      heavy ·{' '}
                      {candidateAnalysis.interactionPenalties.projectConcentration.knownCourseCount}{' '}
                      profiles known
                    </small>
                  </article>
                  <article>
                    <span>Continuous assessment</span>
                    <strong>
                      {formatPenalty(
                        candidateAnalysis.interactionPenalties.continuousAssessmentConcentration
                          .penalty,
                      )}
                    </strong>
                    <small>
                      {
                        candidateAnalysis.interactionPenalties.continuousAssessmentConcentration
                          .heavyCourseCount
                      }{' '}
                      heavy ·{' '}
                      {
                        candidateAnalysis.interactionPenalties.continuousAssessmentConcentration
                          .knownCourseCount
                      }{' '}
                      profiles known
                    </small>
                  </article>
                  <article>
                    <span>Exams</span>
                    <strong>
                      {formatPenalty(
                        candidateAnalysis.interactionPenalties.examConcentration.penalty,
                      )}
                    </strong>
                    <small>
                      {candidateAnalysis.interactionPenalties.examConcentration.heavyCourseCount}{' '}
                      heavy ·{' '}
                      {candidateAnalysis.interactionPenalties.examConcentration.knownCourseCount}{' '}
                      profiles known
                    </small>
                  </article>
                </div>
                <p className="interaction-pressure-help">
                  Penalties begin when at least two known course profiles cross the configured 7/10
                  threshold. Unknown dimensions are not treated as heavy.
                </p>
              </section>
              <section
                className="candidate-metrics-panel"
                aria-labelledby="candidate-metrics-title"
              >
                <div className="interaction-pressure-heading">
                  <div>
                    <p className="eyebrow">PRELIMINARY METRICS</p>
                    <h3 id="candidate-metrics-title">How this option is shaped</h3>
                  </div>
                  <span className="course-meta">
                    Confidence {formatPercent(candidateAnalysis.metrics.analysisConfidence)} ·{' '}
                    Completeness {formatPercent(candidateAnalysis.metrics.dataCompleteness)}
                  </span>
                </div>
                <div className="candidate-metrics-grid">
                  <article>
                    <span>Academic intensity</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.academicIntensity)}</strong>
                    <CandidateMetricExplanation metric="academicIntensity" />
                  </article>
                  <article>
                    <span>Continuous load</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.continuousLoad)}</strong>
                    <CandidateMetricExplanation metric="continuousLoad" />
                  </article>
                  <article>
                    <span>Project load</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.projectLoad)}</strong>
                    <CandidateMetricExplanation metric="projectLoad" />
                  </article>
                  <article>
                    <span>Exam load</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.examLoad)}</strong>
                    <CandidateMetricExplanation metric="examLoad" />
                  </article>
                  <article>
                    <span>Assessment fragmentation</span>
                    <strong>
                      {formatMetric(candidateAnalysis.metrics.assessmentFragmentation)}
                    </strong>
                    <CandidateMetricExplanation metric="assessmentFragmentation" />
                  </article>
                  <article>
                    <span>Schedule quality</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.scheduleQuality)}</strong>
                    <CandidateMetricExplanation metric="scheduleQuality" />
                  </article>
                  <article>
                    <span>Commitment compatibility</span>
                    <strong>
                      {formatMetric(candidateAnalysis.metrics.commitmentCompatibility)}
                    </strong>
                    <CandidateMetricExplanation metric="commitmentCompatibility" />
                  </article>
                  <article>
                    <span>Interest fit</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.interestFit)}</strong>
                    <CandidateMetricExplanation metric="interestFit" />
                  </article>
                  <article>
                    <span>Career fit</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.careerFit)}</strong>
                    <CandidateMetricExplanation metric="careerFit" />
                  </article>
                  <article>
                    <span>Balance</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.balance)}</strong>
                    <CandidateMetricExplanation metric="balance" />
                  </article>
                </div>
                <p className="interaction-pressure-help">
                  These are explainable planning signals, not grades or guarantees. Load metrics are
                  lighter when lower; fit and balance metrics are better when higher. Confidence and
                  completeness show how much known data supports the current estimate.
                </p>
              </section>
              <section className="findings-panel" aria-labelledby="findings-title">
                <div className="interaction-pressure-heading">
                  <div>
                    <p className="eyebrow">STRUCTURED FINDINGS</p>
                    <h3 id="findings-title">What stands out</h3>
                  </div>
                  <span className="course-meta">
                    {candidateAnalysis.findings.length
                      ? `${candidateAnalysis.findings.length} observation${candidateAnalysis.findings.length === 1 ? '' : 's'}`
                      : 'No flagged patterns'}
                  </span>
                </div>
                {candidateAnalysis.findings.length ? (
                  <ul className="finding-list">
                    {candidateAnalysis.findings.map((finding, index) => (
                      <li key={`${finding.type}-${index}`}>
                        <span
                          className={`finding-severity finding-severity-${finding.severity.toLowerCase()}`}
                        >
                          {finding.severity}
                        </span>
                        <div>
                          <strong>{findingTitle(finding.type)}</strong>
                          <p>{findingDescription(finding, selectedCandidate?.selections ?? [])}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="interaction-pressure-help">
                    No configured timetable, workload, commitment, or completeness patterns were
                    detected.
                  </p>
                )}
              </section>
              <section className="schedule-signals-panel" aria-labelledby="schedule-signals-title">
                <div className="interaction-pressure-heading">
                  <div>
                    <p className="eyebrow">SCHEDULE SIGNALS</p>
                    <h3 id="schedule-signals-title">Early, late, and long-day checks</h3>
                  </div>
                  <span className="course-meta">Based on fixed class meetings</span>
                </div>
                <div className="schedule-signal-grid">
                  <article>
                    <span>Early class exposure</span>
                    <strong>
                      {candidateAnalysis.schedule.earlyClassMinutes
                        ? formatMinutes(candidateAnalysis.schedule.earlyClassMinutes)
                        : 'None'}
                    </strong>
                    <small>Class time before 09:00</small>
                  </article>
                  <article>
                    <span>Late class exposure</span>
                    <strong>
                      {candidateAnalysis.schedule.lateClassMinutes
                        ? formatMinutes(candidateAnalysis.schedule.lateClassMinutes)
                        : 'None'}
                    </strong>
                    <small>Class time after 18:00</small>
                  </article>
                  <article>
                    <span>Long days</span>
                    <strong>
                      {candidateAnalysis.schedule.longDays.length
                        ? formatDayList(candidateAnalysis.schedule.longDays)
                        : 'None'}
                    </strong>
                    <small>At least six hours of class time</small>
                  </article>
                </div>
              </section>
              <section className="scenario-panel" aria-labelledby="scenario-title">
                <div className="interaction-pressure-heading">
                  <div>
                    <p className="eyebrow">WHAT-IF SCENARIO</p>
                    <h3 id="scenario-title">Explore a change without saving it</h3>
                  </div>
                  <span className="course-meta">Current candidate stays unchanged</span>
                </div>
                <p className="interaction-pressure-help">
                  A preview changes only this comparison. Nothing is saved: the candidate, your
                  preferences, and the selected sections stay unchanged. “High” gives avoiding
                  modeled workload more weight in the preview.
                </p>
                <div className="scenario-preference-control">
                  <label>
                    Preview a different workload priority
                    <select
                      defaultValue={String(preferenceDraft.workloadPriority)}
                      disabled={Boolean(busyAction)}
                      onChange={(event) => exploreWorkloadPriority(Number(event.target.value))}
                    >
                      {preferenceChoices.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {scenarioAnalysis ? (
                  <div className="scenario-result">
                    <div className="scenario-result-heading">
                      <strong>{scenarioDescription}</strong>
                      <button
                        className="text-button"
                        onClick={() => {
                          setScenarioAnalysis(undefined);
                          setScenarioDescription(undefined);
                        }}
                        type="button"
                      >
                        Clear scenario
                      </button>
                    </div>
                    <div className="scenario-metric-grid">
                      <span>
                        Credits <strong>{scenarioAnalysis.totalCredits}</strong>
                      </span>
                      <span>
                        Intensity{' '}
                        <strong>{formatMetric(scenarioAnalysis.metrics.academicIntensity)}</strong>
                      </span>
                      <span>
                        Projects{' '}
                        <strong>{formatMetric(scenarioAnalysis.metrics.projectLoad)}</strong>
                      </span>
                      <span>
                        Schedule{' '}
                        <strong>{formatMetric(scenarioAnalysis.metrics.scheduleQuality)}</strong>
                      </span>
                      <span>
                        Balance <strong>{formatMetric(scenarioAnalysis.metrics.balance)}</strong>
                      </span>
                    </div>
                    {scenarioAnalysis.findings.length ? (
                      <p className="scenario-findings">
                        {scenarioAnalysis.findings
                          .slice(0, 3)
                          .map((finding) => findingTitle(finding.type))
                          .join(' · ')}
                      </p>
                    ) : (
                      <p className="scenario-findings">No configured findings in this scenario.</p>
                    )}
                  </div>
                ) : (
                  <p className="interaction-pressure-help">
                    Choose “Preview this section”, “Preview without course”, or “Preview without
                    commitment” below to compare a temporary change. The saved candidate stays
                    unchanged.
                  </p>
                )}
              </section>
            </section>
          ) : null}

          {selectedCandidate ? (
            <>
              <section className="weekly-schedule-panel" aria-labelledby="weekly-schedule-title">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">WEEKLY TIMETABLE</p>
                    <h2 id="weekly-schedule-title">Your fixed week</h2>
                  </div>
                  <span className="schedule-legend">
                    <span className="schedule-legend-item course-legend">Course</span>
                    <span className="schedule-legend-item commitment-legend">Commitment</span>
                  </span>
                </div>
                {visibleScheduleEntries.length ? (
                  <div className="schedule-board">
                    <div className="schedule-time-axis" aria-hidden="true">
                      {scheduleAxisHours.map((hour) => (
                        <span
                          key={hour}
                          style={{
                            top: `${((hour * 60 - scheduleStartMinutes) / (scheduleEndMinutes - scheduleStartMinutes)) * 100}%`,
                          }}
                        >
                          {String(hour).padStart(2, '0')}:00
                        </span>
                      ))}
                    </div>
                    {scheduleDays.map((day) => (
                      <section className="schedule-day" key={day} aria-label={day}>
                        <h3>{day.slice(0, 1) + day.slice(1).toLowerCase()}</h3>
                        <div className="schedule-track">
                          {scheduleAxisHours.map((hour) => (
                            <span
                              className="schedule-grid-line"
                              key={hour}
                              style={{
                                top: `${((hour * 60 - scheduleStartMinutes) / (scheduleEndMinutes - scheduleStartMinutes)) * 100}%`,
                              }}
                            />
                          ))}
                          {visibleScheduleEntries
                            .filter((entry) => entry.meeting.day === day)
                            .map((entry) => (
                              <article
                                className={`schedule-block ${entry.kind === 'commitment' ? 'commitment-block' : 'course-block'}${conflictIds.has(entry.sourceId) ? ' conflict-block' : ''}`}
                                key={entry.key}
                                style={scheduleBlockStyle(entry.meeting)}
                              >
                                {conflictIds.has(entry.sourceId) ? (
                                  <span aria-label="Clash">⚠</span>
                                ) : null}
                                <strong>{entry.label}</strong>
                                <small>{entry.detail}</small>
                              </article>
                            ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="schedule-empty">
                    {scheduleEntries.length
                      ? 'No Monday–Friday blocks fall within the displayed 08:00–21:00 schedule.'
                      : 'Add course sections to see the fixed shape of this candidate week.'}
                  </p>
                )}
              </section>

              <section className="commitments-panel" aria-labelledby="commitments-title">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">LIFE OUTSIDE CLASS</p>
                    <h2 id="commitments-title">Commitments</h2>
                  </div>
                  <span className="course-meta">Recurring schedule</span>
                </div>
                <div className="commitments-layout">
                  <div className="commitment-list">
                    {workspace.commitments.length ? (
                      workspace.commitments.map((commitment) => (
                        <article className="commitment-row" key={commitment.id}>
                          <div>
                            <p className="course-code">{commitment.category}</p>
                            <h3>{commitment.name}</h3>
                            <p className="course-meta">
                              {commitment.weeklyEffortHours} hours/week ·{' '}
                              {commitment.flexibility.toLowerCase()}
                            </p>
                            <p className="meeting-summary">
                              {commitment.meetings.length
                                ? commitment.meetings.map(formatMeeting).join(' · ')
                                : 'No fixed recurring time'}
                            </p>
                          </div>
                          <div className="commitment-actions">
                            <button
                              className="secondary-button compact-button"
                              disabled={Boolean(busyAction)}
                              onClick={() => exploreRemoveCommitment(commitment)}
                              type="button"
                            >
                              Preview without
                            </button>
                            <button
                              className="secondary-button compact-button"
                              disabled={Boolean(busyAction)}
                              onClick={() => editCommitment(commitment)}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="danger-button compact-button"
                              disabled={Boolean(busyAction)}
                              onClick={() => removeCommitment(commitment)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="selected-courses-empty">
                        Add a recurring obligation to see how it fits around your courses.
                      </p>
                    )}
                  </div>
                  <form className="commitment-form" onSubmit={saveCommitment}>
                    <div className="panel-heading-row">
                      <h3>{commitmentDraft.id ? 'Edit commitment' : 'Add commitment'}</h3>
                      {commitmentDraft.id ? (
                        <button
                          className="text-button"
                          onClick={() => setCommitmentDraft(emptyCommitmentDraft())}
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                    <label>
                      Name
                      <input
                        maxLength={80}
                        onChange={(event) => updateCommitmentDraft('name', event.target.value)}
                        placeholder="TAship, gym, society…"
                        required
                        value={commitmentDraft.name}
                      />
                    </label>
                    <div className="commitment-form-row">
                      <label>
                        Category
                        <select
                          onChange={(event) =>
                            updateCommitmentDraft('category', event.target.value)
                          }
                          value={commitmentDraft.category}
                        >
                          {commitmentCategories.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Hours / week
                        <input
                          max="168"
                          min="0"
                          onChange={(event) =>
                            updateCommitmentDraft('weeklyEffortHours', event.target.value)
                          }
                          step="0.25"
                          type="number"
                          value={commitmentDraft.weeklyEffortHours}
                        />
                      </label>
                    </div>
                    <label>
                      Flexibility
                      <select
                        onChange={(event) =>
                          updateCommitmentDraft('flexibility', event.target.value)
                        }
                        value={commitmentDraft.flexibility}
                      >
                        <option value="HARD">Hard — cannot move</option>
                        <option value="SOFT">Soft — avoid if possible</option>
                        <option value="FLEXIBLE">Flexible — can move</option>
                      </select>
                    </label>
                    <p className="form-help">
                      Hard blocks cannot overlap classes. Soft blocks may overlap but are flagged;
                      flexible blocks do not block the timetable. Flexibility applies to the whole
                      commitment, so keep fixed office hours and flexible work as separate
                      commitments.
                    </p>
                    <div className="commitment-meetings-heading">
                      <div>
                        <strong>Recurring times</strong>
                        <span>Optional weekly blocks, such as office hours.</span>
                      </div>
                      <button className="text-button" onClick={addCommitmentMeeting} type="button">
                        + Add time
                      </button>
                    </div>
                    <div className="commitment-meeting-editor">
                      {commitmentDraft.meetings.map((meeting, index) => (
                        <div
                          className="commitment-meeting-row"
                          key={`${index}-${meeting.dayOfWeek}`}
                        >
                          <label>
                            <span className="sr-only">Day</span>
                            <select
                              aria-label={`Meeting ${index + 1} day`}
                              onChange={(event) =>
                                updateCommitmentMeeting(index, 'dayOfWeek', event.target.value)
                              }
                              value={meeting.dayOfWeek}
                            >
                              {commitmentDays.map((day) => (
                                <option key={day} value={day}>
                                  {day.slice(0, 1) + day.slice(1).toLowerCase()}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="sr-only">Start time</span>
                            <input
                              aria-label={`Meeting ${index + 1} start time`}
                              onChange={(event) =>
                                updateCommitmentMeeting(index, 'startTime', event.target.value)
                              }
                              type="time"
                              value={meeting.startTime}
                            />
                          </label>
                          <span aria-hidden="true">–</span>
                          <label>
                            <span className="sr-only">End time</span>
                            <input
                              aria-label={`Meeting ${index + 1} end time`}
                              onChange={(event) =>
                                updateCommitmentMeeting(index, 'endTime', event.target.value)
                              }
                              type="time"
                              value={meeting.endTime}
                            />
                          </label>
                          <button
                            aria-label={`Remove meeting ${index + 1}`}
                            className="icon-button"
                            onClick={() => removeCommitmentMeeting(index)}
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    {commitmentFormError ? (
                      <p className="form-error" role="alert">
                        {commitmentFormError}
                      </p>
                    ) : null}
                    <button
                      disabled={busyAction === 'commitment' || !commitmentDraft.name.trim()}
                      type="submit"
                    >
                      {commitmentDraft.id ? 'Save commitment' : 'Add commitment'}
                    </button>
                  </form>
                </div>
                <div className="commitment-events">
                  <div className="commitment-events-heading">
                    <div>
                      <h3>One-off events</h3>
                      <p>
                        Capture an interview, tournament, grading block, or other date-specific
                        demand. Estimated effort is the total extra time around the event, not only
                        the time spent in the event itself.
                      </p>
                    </div>
                    <span className="course-meta">
                      Workload pressure, not the recurring timetable
                    </span>
                  </div>
                  {commitmentEvents.length ? (
                    <div className="commitment-event-list">
                      {commitmentEvents.map((event) => (
                        <article className="commitment-event-row" key={event.id}>
                          <div>
                            <p className="course-code">{event.commitmentName}</p>
                            <h4>{event.title}</h4>
                            <p className="course-meta">
                              {new Date(event.startAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}{' '}
                              –{' '}
                              {new Date(event.endAt).toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                              {' · '}
                              {event.estimatedEffortHours === null
                                ? 'Effort unknown'
                                : `${event.estimatedEffortHours} hours estimated`}
                            </p>
                          </div>
                          <div className="commitment-actions">
                            <button
                              className="secondary-button compact-button"
                              disabled={Boolean(busyAction)}
                              onClick={() => editCommitmentEvent(event, event.commitmentId)}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="danger-button compact-button"
                              disabled={Boolean(busyAction)}
                              onClick={() => removeCommitmentEvent(event)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="selected-courses-empty">
                      No one-off events yet. Add one for a date-specific commitment.
                    </p>
                  )}
                  <form className="commitment-event-form" onSubmit={saveCommitmentEvent}>
                    <div className="panel-heading-row">
                      <h4>
                        {commitmentEventDraft.id ? 'Edit one-off event' : 'Add one-off event'}
                      </h4>
                      {commitmentEventDraft.id ? (
                        <button
                          className="text-button"
                          onClick={() =>
                            setCommitmentEventDraft(
                              emptyCommitmentEventDraft(commitmentEventDraft.commitmentId),
                            )
                          }
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                    <div className="commitment-event-form-row">
                      <label>
                        Parent commitment
                        <select
                          disabled={Boolean(commitmentEventDraft.id)}
                          onChange={(event) =>
                            setCommitmentEventDraft((current) => ({
                              ...current,
                              commitmentId: event.target.value,
                            }))
                          }
                          required
                          value={commitmentEventDraft.commitmentId}
                        >
                          <option value="">Choose a commitment</option>
                          {workspace.commitments.map((commitment) => (
                            <option key={commitment.id} value={commitment.id}>
                              {commitment.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Event title
                        <input
                          maxLength={120}
                          onChange={(event) =>
                            setCommitmentEventDraft((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder="e.g. Lahore Cup"
                          required
                          value={commitmentEventDraft.title}
                        />
                      </label>
                    </div>
                    <div className="commitment-event-form-row">
                      <label>
                        Starts
                        <input
                          onChange={(event) =>
                            setCommitmentEventDraft((current) => ({
                              ...current,
                              startAt: event.target.value,
                            }))
                          }
                          required
                          type="datetime-local"
                          value={commitmentEventDraft.startAt}
                        />
                      </label>
                      <label>
                        Ends
                        <input
                          onChange={(event) =>
                            setCommitmentEventDraft((current) => ({
                              ...current,
                              endAt: event.target.value,
                            }))
                          }
                          required
                          type="datetime-local"
                          value={commitmentEventDraft.endAt}
                        />
                      </label>
                    </div>
                    <div className="commitment-event-form-row">
                      <label>
                        Estimated effort hours
                        <input
                          max="168"
                          min="0"
                          onChange={(event) =>
                            setCommitmentEventDraft((current) => ({
                              ...current,
                              estimatedEffortHours: event.target.value,
                            }))
                          }
                          placeholder="Optional"
                          step="0.25"
                          type="number"
                          value={commitmentEventDraft.estimatedEffortHours}
                        />
                      </label>
                      <label>
                        Flexibility for this event
                        <select
                          onChange={(event) =>
                            setCommitmentEventDraft((current) => ({
                              ...current,
                              flexibilityOverride: event.target.value as
                                CommitmentFlexibility | 'INHERIT',
                            }))
                          }
                          value={commitmentEventDraft.flexibilityOverride}
                        >
                          <option value="INHERIT">Use parent commitment</option>
                          <option value="HARD">Hard — cannot move</option>
                          <option value="SOFT">Soft — avoid if possible</option>
                          <option value="FLEXIBLE">Flexible — can move</option>
                        </select>
                      </label>
                    </div>
                    <button
                      disabled={
                        Boolean(busyAction) ||
                        !workspace.commitments.length ||
                        !commitmentEventDraft.commitmentId
                      }
                      type="submit"
                    >
                      {commitmentEventDraft.id ? 'Save event' : 'Add event'}
                    </button>
                    {!workspace.commitments.length ? (
                      <small className="form-help">
                        Add a commitment first so this event has the right category and ownership.
                      </small>
                    ) : null}
                  </form>
                </div>
              </section>

              <section className="preferences-panel" aria-labelledby="preferences-title">
                <div className="panel-heading-row">
                  <div>
                    <p className="eyebrow">YOUR PRIORITIES</p>
                    <h2 id="preferences-title">Shape the semester around you</h2>
                  </div>
                  <span className="course-meta">Saved per semester</span>
                </div>
                <form className="preferences-form" onSubmit={savePreferences}>
                  <p className="preferences-intro">
                    Choose what matters most. These preferences guide semester comparisons without
                    forcing you through a long setup. If you have not saved preferences yet, every
                    choice starts at Medium.
                  </p>
                  <div className="preference-grid">
                    {(
                      [
                        ['workloadPriority', 'Manageable workload'],
                        ['schedulePriority', 'Compact schedule'],
                        ['careerPriority', 'Career relevance'],
                        ['interestPriority', 'Subject interest'],
                        ['freeDayPriority', 'Free-day importance'],
                        ['earlyClassAversion', 'Avoid early classes'],
                        ['lateClassAversion', 'Avoid late classes'],
                      ] as Array<[keyof PreferenceDraft, string]>
                    ).map(([field, label]) => (
                      <label key={field}>
                        {label}
                        <select
                          onChange={(event) => updatePreference(field, Number(event.target.value))}
                          value={String(preferenceDraft[field])}
                        >
                          {preferenceChoices.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <label>
                      Assessment style
                      <select
                        onChange={(event) => updateAssessmentStyle(event.target.value)}
                        value={assessmentStyle()}
                      >
                        <option value="BALANCED">Balanced projects and exams</option>
                        <option value="PROJECTS">Prefer projects</option>
                        <option value="EXAMS">Prefer exams</option>
                      </select>
                    </label>
                  </div>
                  <div className="preferences-actions">
                    <p>Values are stored on a normalized low / medium / high scale.</p>
                    <button disabled={busyAction === 'preferences'} type="submit">
                      Save preferences
                    </button>
                  </div>
                </form>
              </section>

              <section className="candidate-workbench">
                <div className="candidate-summary">
                  <p className="eyebrow">CURRENT OPTION</p>
                  <form className="rename-form" onSubmit={renameCandidate}>
                    <label className="sr-only" htmlFor="selected-candidate-name">
                      Candidate name
                    </label>
                    <input
                      id="selected-candidate-name"
                      maxLength={80}
                      onChange={(event) => setEditedName(event.target.value)}
                      value={editedName}
                    />
                    <button
                      className="secondary-button compact-button"
                      disabled={busyAction === 'rename' || !editedName.trim()}
                      type="submit"
                    >
                      Rename
                    </button>
                  </form>
                  <p>
                    {selectedCandidate.selectionCount === 0
                      ? 'No sections selected yet.'
                      : `${selectedCandidate.selectionCount} selected sections`}
                  </p>
                  <p className="credit-total">
                    <strong>{selectedCandidate.credits}</strong> credits
                  </p>
                  <div className="candidate-actions">
                    <button
                      className="secondary-button compact-button"
                      disabled={Boolean(busyAction)}
                      onClick={() =>
                        void runMutation('duplicate', () =>
                          apiRequest(`/api/candidates/${selectedCandidate.id}/duplicate`, {
                            method: 'POST',
                          }),
                        )
                      }
                      type="button"
                    >
                      Duplicate
                    </button>
                    <button
                      className="danger-button compact-button"
                      disabled={Boolean(busyAction)}
                      onClick={() => {
                        if (!window.confirm(`Archive ${selectedCandidate.name}?`)) return;
                        void runMutation('archive', () =>
                          apiRequest(`/api/candidates/${selectedCandidate.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ isArchived: true }),
                          }),
                        );
                      }}
                      type="button"
                    >
                      Archive
                    </button>
                  </div>
                </div>
                <div className="selected-courses-panel">
                  <div className="panel-heading-row">
                    <div>
                      <p className="eyebrow">SELECTED COURSES</p>
                      <h2>{selectedCandidate.name}</h2>
                    </div>
                    <span className="credit-badge">{selectedCandidate.credits} credits</span>
                  </div>
                  {selectedCandidate.selections.length ? (
                    <div className="selected-course-list">
                      {selectedCandidate.selections.map((selection) => {
                        const workloadAnalysis = candidateAnalysis?.workloadProfiles.find(
                          (item) => item.courseOfferingId === selection.courseOfferingId,
                        );
                        const profile = workloadAnalysis?.profile;
                        const coursePreference = workspace.coursePreferences.find(
                          (item) => item.courseOfferingId === selection.courseOfferingId,
                        );
                        return (
                          <article className="selected-course-row" key={selection.id}>
                            <div className="selected-course-main">
                              <div>
                                <p className="course-code">{selection.courseCode}</p>
                                <h3>{selection.title}</h3>
                                <p className="course-meta">
                                  Section {selection.sectionCode} · {selection.credits} credits
                                </p>
                                <p className="meeting-summary">
                                  {selection.meetings.map(formatMeeting).join(' · ') ||
                                    'Timing TBA'}
                                </p>
                              </div>
                              <details className="course-preference-editor">
                                <summary>
                                  <span>Course fit · interest and career relevance</span>
                                  <small>
                                    {coursePreference?.interestScore === null ||
                                    coursePreference?.interestScore === undefined
                                      ? 'Not rated'
                                      : `Interest ${formatPreferenceFit(coursePreference.interestScore)}`}
                                  </small>
                                </summary>
                                <form
                                  onSubmit={(event) =>
                                    saveCoursePreference(selection.courseOfferingId, event)
                                  }
                                >
                                  <p className="workload-editor-help">
                                    These ratings stay with this course offering across your
                                    semester options.
                                  </p>
                                  <div className="course-preference-field-grid">
                                    <label>
                                      Interest
                                      <select
                                        defaultValue={coursePreference?.interestScore ?? ''}
                                        name="interestScore"
                                      >
                                        <option value="">Not rated</option>
                                        <option value="0">Low</option>
                                        <option value="0.5">Medium</option>
                                        <option value="1">High</option>
                                      </select>
                                    </label>
                                    <label>
                                      Career relevance
                                      <select
                                        defaultValue={coursePreference?.careerRelevanceScore ?? ''}
                                        name="careerRelevanceScore"
                                      >
                                        <option value="">Not rated</option>
                                        <option value="0">Low</option>
                                        <option value="0.5">Medium</option>
                                        <option value="1">High</option>
                                      </select>
                                    </label>
                                  </div>
                                  <div className="workload-editor-actions">
                                    <span>Used in preliminary course-fit analysis.</span>
                                    <div>
                                      <button
                                        className="secondary-button compact-button"
                                        disabled={Boolean(busyAction)}
                                        type="submit"
                                      >
                                        Save ratings
                                      </button>
                                      {coursePreference ? (
                                        <button
                                          className="text-button"
                                          disabled={Boolean(busyAction)}
                                          onClick={() =>
                                            resetCoursePreference(selection.courseOfferingId)
                                          }
                                          type="button"
                                        >
                                          Clear ratings
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </form>
                              </details>
                              {profile ? (
                                <details className="workload-editor">
                                  <summary>
                                    <span>
                                      Workload assumptions ·{' '}
                                      {profile.source === 'USER_ESTIMATE'
                                        ? 'Your estimate'
                                        : 'Structural estimate'}
                                    </span>
                                    <small>
                                      {Math.round(profile.confidence * 100)}% confidence
                                    </small>
                                  </summary>
                                  <form
                                    noValidate
                                    onSubmit={(event) =>
                                      saveWorkloadProfile(selection.courseOfferingId, event)
                                    }
                                  >
                                    <p className="workload-editor-help">
                                      Semora starts with structural estimates where available. You
                                      can adjust them manually; blank means unknown. The spinner
                                      moves in 0.25 steps, but existing values such as 6.63 remain
                                      valid and save unchanged until you adjust them. Higher values
                                      mean heavier modeled demand, not better performance.
                                    </p>
                                    <div className="workload-field-grid">
                                      {workloadProfileFields.map(([field, label]) => (
                                        <label key={field}>
                                          {label}
                                          <input
                                            defaultValue={profile[field] ?? ''}
                                            max="10"
                                            min="0"
                                            name={field}
                                            placeholder="Unknown"
                                            step="0.25"
                                            type="number"
                                          />
                                        </label>
                                      ))}
                                      <label>
                                        Estimated hours / week
                                        <input
                                          defaultValue={profile.estimatedWeeklyHours ?? ''}
                                          max="168"
                                          min="0"
                                          name="estimatedWeeklyHours"
                                          placeholder="Unknown"
                                          step="0.25"
                                          type="number"
                                        />
                                      </label>
                                    </div>
                                    <div className="workload-editor-actions">
                                      <span>
                                        Saved once per course offering in this workspace and reused
                                        by every candidate.
                                      </span>
                                      <div>
                                        <button
                                          className="secondary-button compact-button"
                                          disabled={Boolean(busyAction)}
                                          type="submit"
                                        >
                                          Save estimate
                                        </button>
                                        {profile.source === 'USER_ESTIMATE' ? (
                                          <button
                                            className="text-button"
                                            disabled={Boolean(busyAction)}
                                            onClick={() =>
                                              resetWorkloadProfile(selection.courseOfferingId)
                                            }
                                            type="button"
                                          >
                                            Reset structural estimate
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  </form>
                                </details>
                              ) : null}
                            </div>
                            <div className="selected-course-actions">
                              <button
                                className="secondary-button compact-button"
                                disabled={Boolean(busyAction)}
                                onClick={() => openSelectedCourse(selection)}
                                type="button"
                              >
                                Change section
                              </button>
                              <button
                                className="secondary-button compact-button"
                                disabled={Boolean(busyAction)}
                                onClick={() => exploreRemoveCourse(selection)}
                                type="button"
                              >
                                Preview without course
                              </button>
                              <button
                                className="danger-button compact-button"
                                disabled={Boolean(busyAction)}
                                onClick={() => removeSelection(selection.id)}
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="selected-courses-empty">
                      Search the catalogue below to add your first course section.
                    </p>
                  )}
                </div>
              </section>

              <section className="planner-selection-layout">
                <section className="planner-course-browser" aria-labelledby="course-browser-title">
                  <div className="panel-heading-row">
                    <div>
                      <p className="eyebrow">COURSE CATALOGUE</p>
                      <h2 id="course-browser-title">Add a section</h2>
                    </div>
                    <Link className="back-link" to={`/catalogue?termId=${workspace.term.id}`}>
                      Full catalogue
                    </Link>
                  </div>
                  <form className="planner-search" onSubmit={searchCourses}>
                    <label className="sr-only" htmlFor="planner-course-search">
                      Search courses
                    </label>
                    <input
                      id="planner-course-search"
                      onChange={(event) => setCourseSearch(event.target.value)}
                      placeholder="Search by code or title"
                      value={courseSearch}
                    />
                    <button disabled={!courseSearch.trim()} type="submit">
                      Search
                    </button>
                  </form>
                  {isCatalogueLoading ? (
                    <p className="catalogue-message">Searching courses…</p>
                  ) : null}
                  {!isCatalogueLoading && appliedCourseSearch && !catalogueCourses.length ? (
                    <p className="catalogue-message">No courses match “{appliedCourseSearch}”.</p>
                  ) : null}
                  <div className="planner-course-results">
                    {catalogueCourses.map((course) => (
                      <button
                        className={
                          course.id === activeOfferingId
                            ? 'planner-course-row active'
                            : 'planner-course-row'
                        }
                        key={course.id}
                        onClick={() => openOffering(course)}
                        type="button"
                      >
                        <span>
                          <strong>{course.courseCode}</strong>
                          <span>{course.title}</span>
                        </span>
                        <small>
                          {course.credits} cr · {course.sections.length} sections
                        </small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="section-picker" aria-labelledby="section-picker-title">
                  {activeOffering ? (
                    <>
                      <div className="panel-heading-row">
                        <div>
                          <p className="eyebrow">SECTION OPTIONS</p>
                          <h2 id="section-picker-title">{activeOffering.courseCode}</h2>
                          <p className="course-meta">{activeOffering.title}</p>
                        </div>
                        <span className="credit-badge">{activeOffering.credits} credits</span>
                      </div>
                      {busyAction === 'selection' ? (
                        <InlineState label="Updating this candidate…" />
                      ) : null}
                      <div aria-busy={busyAction === 'selection'} className="section-option-list">
                        {activeOffering.sections.map((section) => {
                          const isSelected = activeSelection?.sectionId === section.id;
                          return (
                            <article
                              className={isSelected ? 'section-option selected' : 'section-option'}
                              key={section.id}
                            >
                              <div>
                                <h3>Section {section.sectionCode}</h3>
                                <p>{section.instructor ?? 'Instructor not provided'}</p>
                                <p className="meeting-summary">
                                  {section.meetings.map(formatMeeting).join(' · ') || 'Timing TBA'}
                                </p>
                              </div>
                              <button
                                className={
                                  isSelected ? 'secondary-button compact-button' : 'compact-button'
                                }
                                disabled={Boolean(busyAction) || isSelected}
                                onClick={() => chooseSection(section.id)}
                                type="button"
                              >
                                {isSelected
                                  ? 'Selected'
                                  : activeSelection
                                    ? 'Switch to this section'
                                    : 'Add section'}
                              </button>
                              {!isSelected ? (
                                <button
                                  className="text-button"
                                  disabled={Boolean(busyAction)}
                                  onClick={() => exploreSection(section.id)}
                                  type="button"
                                >
                                  Preview this section
                                </button>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="planner-empty-state compact-empty">
                      <p className="eyebrow">SECTION OPTIONS</p>
                      <h2>Choose a course.</h2>
                      <p>
                        Search the catalogue and select a course to see its available sections and
                        timings.
                      </p>
                    </div>
                  )}
                </section>
              </section>
            </>
          ) : (
            <section className="planner-empty-state standalone-empty">
              <p className="eyebrow">YOUR FIRST OPTION</p>
              <h2>Create a candidate semester.</h2>
              <p>
                Start with one possible route, then duplicate it when you want to explore a
                trade-off.
              </p>
            </section>
          )}
        </>
      ) : (
        <PageState
          eyebrow="PLAN / SEMESTER DESIGNER"
          message={error ?? 'The semester workspace could not be loaded.'}
          title="Your semester workspace is unavailable."
          tone="error"
        />
      )}
    </main>
  );
}

const ASSESSMENT_PAGE_SIZE = 6;

function ActiveSemesterView({
  workspace,
  onReload,
}: {
  workspace: Workspace;
  onReload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [courseSearch, setCourseSearch] = useState('');
  const [appliedCourseSearch, setAppliedCourseSearch] = useState('');
  const [catalogueCourses, setCatalogueCourses] = useState<CatalogueCourse[]>([]);
  const [activeOfferingId, setActiveOfferingId] = useState<string>();
  const [isCatalogueLoading, setIsCatalogueLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string>();
  const [error, setError] = useState<string>();
  const [outlineRecovery, setOutlineRecovery] = useState<Record<string, OutlineRecovery>>({});
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [gradeSummaries, setGradeSummaries] = useState<GradeSummary[]>([]);
  const [isAssessmentsLoading, setIsAssessmentsLoading] = useState(true);
  const [assessmentSearch, setAssessmentSearch] = useState('');
  const [assessmentTypeFilter, setAssessmentTypeFilter] = useState<AssessmentType | ''>('');
  const [assessmentCourseFilter, setAssessmentCourseFilter] = useState('');
  const [assessmentVisibleCount, setAssessmentVisibleCount] = useState(ASSESSMENT_PAGE_SIZE);
  const [workload, setWorkload] = useState<Workload>();
  const [isWorkloadLoading, setIsWorkloadLoading] = useState(true);
  const [forecastFeedback, setForecastFeedback] = useState<string>();
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>();
  const [assessmentDraft, setAssessmentDraft] = useState<AssessmentDraft>({
    activeSelectionId: workspace.activeCourseSelections[0]?.id ?? '',
    title: '',
    assessmentType: 'ASSIGNMENT',
    weightPercentage: '',
    dueDate: '',
    progressPercentage: '0',
    personalEffortHours: '',
  });
  const [editingAssessmentId, setEditingAssessmentId] = useState<string>();
  const assessmentEntryFormRef = useRef<HTMLFormElement>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [scoreModes, setScoreModes] = useState<Record<string, AssessmentScoreMode>>({});
  const [classStatisticsDrafts, setClassStatisticsDrafts] = useState<
    Record<string, ClassStatisticsDraft>
  >({});
  const [gradeScenarioDrafts, setGradeScenarioDrafts] = useState<Record<string, string>>({});
  const [gradeScenarioSummaries, setGradeScenarioSummaries] = useState<
    Record<string, GradeSummary>
  >({});
  const assessmentSearchTerms = assessmentSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filteredAssessments = assessments.filter((assessment) => {
    if (assessmentTypeFilter && assessment.assessmentType !== assessmentTypeFilter) return false;
    if (assessmentCourseFilter && assessment.activeSelectionId !== assessmentCourseFilter) {
      return false;
    }
    if (!assessmentSearchTerms.length) return true;
    const searchable = [
      assessment.courseCode,
      assessment.courseTitle,
      assessment.title,
      assessment.assessmentType,
    ]
      .join(' ')
      .toLowerCase();
    return assessmentSearchTerms.every((term) => searchable.includes(term));
  });
  const visibleAssessments = filteredAssessments.slice(0, assessmentVisibleCount);
  const hasAssessmentFilters = Boolean(
    assessmentSearch.trim() || assessmentTypeFilter || assessmentCourseFilter,
  );

  async function loadAssessments() {
    setIsAssessmentsLoading(true);
    try {
      const result = await apiRequest<{
        assessments: Assessment[];
        gradeSummaries: GradeSummary[];
      }>(`/api/workspaces/${workspace.id}/assessments`);
      setAssessments(result.assessments);
      setAssessmentVisibleCount(ASSESSMENT_PAGE_SIZE);
      setGradeSummaries(result.gradeSummaries);
      setGradeScenarioSummaries({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load assessments.');
    } finally {
      setIsAssessmentsLoading(false);
    }
  }

  async function loadWorkload() {
    setIsWorkloadLoading(true);
    try {
      const result = await apiRequest<{ workload: Workload }>(
        `/api/workspaces/${workspace.id}/workload`,
      );
      setWorkload(result.workload);
      setSelectedWeekStart((current) =>
        current && result.workload.weeklyPressure.some((week) => week.weekStart === current)
          ? current
          : (result.workload.currentWeekPressure?.weekStart ??
            result.workload.weeklyPressure[0]?.weekStart),
      );
      return result.workload;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to calculate workload.');
      return undefined;
    } finally {
      setIsWorkloadLoading(false);
    }
  }

  useEffect(() => {
    void loadAssessments();
    void loadWorkload();
  }, [workspace.id]);

  useEffect(() => {
    if (
      assessmentDraft.activeSelectionId &&
      workspace.activeCourseSelections.some(
        (selection) => selection.id === assessmentDraft.activeSelectionId,
      )
    ) {
      return;
    }
    setAssessmentDraft((draft) => ({
      ...draft,
      activeSelectionId: workspace.activeCourseSelections[0]?.id ?? '',
    }));
  }, [workspace.activeCourseSelections, assessmentDraft.activeSelectionId]);

  useEffect(() => {
    if (!appliedCourseSearch) {
      setCatalogueCourses([]);
      setIsCatalogueLoading(false);
      return;
    }
    let isCurrent = true;
    setIsCatalogueLoading(true);
    apiRequest<{ courses: CatalogueCourse[] }>(
      `/api/catalogue?termId=${encodeURIComponent(workspace.term.id)}&q=${encodeURIComponent(appliedCourseSearch)}`,
    )
      .then((result) => {
        if (isCurrent) setCatalogueCourses(result.courses);
      })
      .catch((reason: unknown) => {
        if (isCurrent) {
          setError(reason instanceof Error ? reason.message : 'Unable to search courses.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsCatalogueLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [appliedCourseSearch, workspace.term.id]);

  async function retryDashboardData() {
    setError(undefined);
    await Promise.all([loadAssessments(), loadWorkload()]);
  }

  async function runMutation(
    action: string,
    mutation: () => Promise<unknown>,
    onWorkloadReloaded?: (nextWorkload: Workload | undefined) => void,
    reloadWorkspace = true,
  ) {
    setError(undefined);
    setForecastFeedback(undefined);
    setBusyAction(action);
    try {
      await mutation();
      if (reloadWorkspace) await onReload();
      const [, nextWorkload] = await Promise.all([loadAssessments(), loadWorkload()]);
      onWorkloadReloaded?.(nextWorkload);
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to save this active semester change.',
      );
      return false;
    } finally {
      setBusyAction(undefined);
    }
  }

  function runAssessmentMutation(
    action: string,
    mutation: () => Promise<unknown>,
    onWorkloadReloaded?: (nextWorkload: Workload | undefined) => void,
  ) {
    return runMutation(action, mutation, onWorkloadReloaded, false);
  }

  function searchCourses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedCourseSearch(courseSearch.trim());
    setActiveOfferingId(undefined);
  }

  function chooseSection(sectionId: string) {
    if (!activeOfferingId) return;
    const existing = workspace.activeCourseSelections.find(
      (selection) => selection.courseOfferingId === activeOfferingId,
    );
    void runMutation('active-selection', () =>
      apiRequest(
        existing
          ? `/api/active-selections/${existing.id}`
          : `/api/workspaces/${workspace.id}/active-selections`,
        {
          method: existing ? 'PATCH' : 'POST',
          body: JSON.stringify({ sectionId }),
        },
      ),
    ).then((succeeded) => {
      if (succeeded) setActiveOfferingId(undefined);
    });
  }

  function dropCourse(selection: ActiveCourseSelection) {
    if (!window.confirm(`Drop ${selection.courseCode} from this semester?`)) return;
    void runMutation('drop-course', () =>
      apiRequest(`/api/active-selections/${selection.id}/drop`, { method: 'POST' }),
    );
  }

  function setOutlineRecoveryMessage(selectionId: string, jobId: string, message: string) {
    setOutlineRecovery((current) => ({ ...current, [selectionId]: { jobId, message } }));
  }

  function clearOutlineRecovery(selectionId: string) {
    setOutlineRecovery((current) => {
      const next = { ...current };
      delete next[selectionId];
      return next;
    });
  }

  async function retryOutlineExtraction(selection: ActiveCourseSelection) {
    const jobId = selection.state?.outline?.extractionJob?.id;
    if (!jobId) return;
    const action = 'outline-retry-' + selection.id;
    setBusyAction(action);
    setError(undefined);
    clearOutlineRecovery(selection.id);
    try {
      const processed = await apiRequest<{ extractionJob: { id: string; status: string } }>(
        '/api/extraction-jobs/' + jobId + '/process',
        { method: 'POST' },
      );
      if (processed.extractionJob.status !== 'REVIEW_REQUIRED') {
        await onReload();
        setOutlineRecoveryMessage(
          selection.id,
          jobId,
          'The outline is still saved, but Semora could not extract a reviewable draft. No course data was changed.',
        );
        return;
      }
      await onReload();
      navigate('/extraction-review/' + jobId);
    } catch (reason) {
      setOutlineRecoveryMessage(
        selection.id,
        jobId,
        reason instanceof Error
          ? reason.message + ' The uploaded outline is still safe, and no course data was changed.'
          : 'Semora could not retry this outline. The uploaded file is still safe, and no course data was changed.',
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  function resetAssessmentDraft(selectionId = workspace.activeCourseSelections[0]?.id ?? '') {
    setAssessmentDraft({
      activeSelectionId: selectionId,
      title: '',
      assessmentType: 'ASSIGNMENT',
      weightPercentage: '',
      dueDate: '',
      progressPercentage: '0',
      personalEffortHours: '',
    });
  }

  function enterAssessmentManually(selectionId: string) {
    resetAssessmentDraft(selectionId);
    requestAnimationFrame(() => {
      const form = assessmentEntryFormRef.current;
      if (!form) return;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      form.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      form.querySelector<HTMLInputElement>('input[placeholder="e.g. Assignment 2"]')?.focus();
    });
  }

  function editAssessment(assessment: Assessment) {
    setEditingAssessmentId(assessment.id);
    setAssessmentDraft({
      activeSelectionId: assessment.activeSelectionId,
      title: assessment.title,
      assessmentType: assessment.assessmentType,
      weightPercentage:
        assessment.effectiveWeightPercentage?.toString() ??
        assessment.weightPercentage?.toString() ??
        '',
      dueDate: assessment.dueDate ?? '',
      progressPercentage: Math.round(assessment.progressPercentage ?? 0).toString(),
      personalEffortHours: assessment.personalEffortHours?.toString() ?? '',
    });
    requestAnimationFrame(() => {
      const form = assessmentEntryFormRef.current;
      if (!form) return;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      form.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      form.querySelector<HTMLInputElement>('input[placeholder="e.g. Assignment 2"]')?.focus();
    });
  }

  function assessmentDraftError() {
    const boundedNumberError = (
      value: string,
      label: string,
      minimum: number,
      maximum: number,
      suffix = '',
    ) => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
        ? undefined
        : `${label} must be between ${minimum} and ${maximum}${suffix}.`;
    };

    const weightError = boundedNumberError(assessmentDraft.weightPercentage, 'Weight', 0, 100);
    if (weightError) return weightError;
    const progressError = boundedNumberError(
      assessmentDraft.progressPercentage,
      'Work progress',
      0,
      100,
    );
    if (progressError) return progressError;
    const effortError = boundedNumberError(
      assessmentDraft.personalEffortHours,
      'Personal effort',
      0,
      168,
      ' hours',
    );
    if (effortError) return effortError;

    if (assessmentDraft.dueDate) {
      const parsed = new Date(`${assessmentDraft.dueDate}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(assessmentDraft.dueDate) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== assessmentDraft.dueDate
      ) {
        return 'Due date must be a real calendar date or left blank.';
      }
    }

    return undefined;
  }

  function assessmentPayload() {
    const weight = assessmentDraft.weightPercentage.trim();
    const progress = assessmentDraft.progressPercentage.trim();
    const personalEffort = assessmentDraft.personalEffortHours.trim();
    return {
      title: assessmentDraft.title.trim(),
      assessmentType: assessmentDraft.assessmentType,
      weightPercentage: weight ? Number(weight) : null,
      dueDate: assessmentDraft.dueDate || null,
      datePrecision: assessmentDraft.dueDate ? 'EXACT' : 'UNKNOWN',
      progressPercentage: progress ? Number(progress) : 0,
      personalEffortHours: personalEffort ? Number(personalEffort) : null,
    };
  }

  function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessmentDraft.activeSelectionId || !assessmentDraft.title.trim()) return;
    const validationMessage = assessmentDraftError();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    const payload = assessmentPayload();
    if (editingAssessmentId) {
      void runAssessmentMutation('assessment-edit', () =>
        apiRequest(`/api/assessments/${editingAssessmentId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
      ).then((succeeded) => {
        if (succeeded) {
          setEditingAssessmentId(undefined);
          resetAssessmentDraft();
        }
      });
      return;
    }
    void runAssessmentMutation('assessment-create', () =>
      apiRequest(`/api/active-selections/${assessmentDraft.activeSelectionId}/assessments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ).then((succeeded) => {
      if (succeeded) resetAssessmentDraft(assessmentDraft.activeSelectionId);
    });
  }

  function cancelAssessment(assessment: Assessment) {
    if (!window.confirm(`Cancel ${assessment.title}? It will remain in your history.`)) return;
    void runAssessmentMutation(`assessment-cancel-${assessment.id}`, () =>
      apiRequest(`/api/assessments/${assessment.id}`, { method: 'DELETE' }),
    );
  }

  function markAssessmentDone(assessment: Assessment) {
    const previousWorkload = workload;
    void runAssessmentMutation(
      `assessment-done-${assessment.id}`,
      () =>
        apiRequest(`/api/assessments/${assessment.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ workStatus: 'DONE' }),
        }),
      (nextWorkload) => {
        const previousNextWeek = nextWeekPressure(previousWorkload);
        const nextNextWeek = nextWeekPressure(nextWorkload);
        if (previousNextWeek && nextNextWeek && nextNextWeek.pressure < previousNextWeek.pressure) {
          setForecastFeedback(
            `Forecast updated — next week's pressure decreased from ${previousNextWeek.pressure.toFixed(1)} to ${nextNextWeek.pressure.toFixed(1)} after completing ${assessment.title}.`,
          );
          return;
        }
        setForecastFeedback(`Forecast updated after completing ${assessment.title}.`);
      },
    );
  }

  function scoreModeFor(assessment: Assessment): AssessmentScoreMode {
    return (
      scoreModes[assessment.id] ??
      (assessment.score?.pointsEarned != null || assessment.pointsPossible !== null
        ? 'POINTS'
        : 'PERCENTAGE')
    );
  }

  function scoreDraftFor(assessment: Assessment) {
    const mode = scoreModeFor(assessment);
    const draft = scoreDrafts[assessment.id];
    if (draft !== undefined) return draft;
    return mode === 'POINTS'
      ? (assessment.score?.pointsEarned?.toString() ?? '')
      : (assessment.score?.percentage?.toString() ?? '');
  }

  function saveAssessmentScore(assessment: Assessment) {
    const rawValue = scoreDraftFor(assessment).trim();
    const value = Number(rawValue);
    const mode = scoreModeFor(assessment);
    if (!rawValue || !Number.isFinite(value)) {
      setError('Enter a numeric score before saving.');
      return;
    }
    if (
      mode === 'POINTS' &&
      assessment.pointsPossible !== null &&
      value > assessment.pointsPossible
    ) {
      setError('Points earned cannot exceed the points possible for this assessment.');
      return;
    }

    void runAssessmentMutation('assessment-score-' + assessment.id, () =>
      apiRequest('/api/assessments/' + assessment.id + '/score', {
        method: 'PUT',
        body: JSON.stringify(mode === 'POINTS' ? { pointsEarned: value } : { percentage: value }),
      }),
    ).then((succeeded) => {
      if (succeeded) {
        setScoreDrafts((drafts) => {
          const next = { ...drafts };
          delete next[assessment.id];
          return next;
        });
      }
    });
  }

  function clearAssessmentScore(assessment: Assessment) {
    void runAssessmentMutation('assessment-score-clear-' + assessment.id, () =>
      apiRequest('/api/assessments/' + assessment.id + '/score', { method: 'DELETE' }),
    ).then((succeeded) => {
      if (succeeded) {
        setScoreDrafts((drafts) => {
          const next = { ...drafts };
          delete next[assessment.id];
          return next;
        });
      }
    });
  }
  function classStatisticsDraftFor(assessment: Assessment): ClassStatisticsDraft {
    return (
      classStatisticsDrafts[assessment.id] ?? {
        mean: assessment.classStatistics?.mean.toString() ?? '',
        median: assessment.classStatistics?.median?.toString() ?? '',
        standardDeviation: assessment.classStatistics?.standardDeviation?.toString() ?? '',
      }
    );
  }

  function saveClassStatistics(assessment: Assessment) {
    const draft = classStatisticsDraftFor(assessment);
    const mean = Number(draft.mean.trim());
    if (!draft.mean.trim() || !Number.isFinite(mean) || mean < 0 || mean > 100) {
      setError('Enter a class mean between 0 and 100.');
      return;
    }
    const optionalValue = (value: string, label: string) => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error(label + ' must be between 0 and 100.');
      }
      return parsed;
    };
    let median: number | null;
    let standardDeviation: number | null;
    try {
      median = optionalValue(draft.median, 'Class median');
      standardDeviation = optionalValue(draft.standardDeviation, 'Class standard deviation');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Class statistics are invalid.');
      return;
    }

    void runAssessmentMutation('assessment-class-statistics-' + assessment.id, () =>
      apiRequest('/api/assessments/' + assessment.id + '/class-statistics', {
        method: 'PUT',
        body: JSON.stringify({ mean, median, standardDeviation }),
      }),
    ).then((succeeded) => {
      if (succeeded) {
        setClassStatisticsDrafts((drafts) => {
          const next = { ...drafts };
          delete next[assessment.id];
          return next;
        });
      }
    });
  }

  function clearClassStatistics(assessment: Assessment) {
    void runAssessmentMutation('assessment-class-statistics-clear-' + assessment.id, () =>
      apiRequest('/api/assessments/' + assessment.id + '/class-statistics', { method: 'DELETE' }),
    ).then((succeeded) => {
      if (succeeded) {
        setClassStatisticsDrafts((drafts) => {
          const next = { ...drafts };
          delete next[assessment.id];
          return next;
        });
      }
    });
  }
  function runGradeScenario(summary: GradeSummary, scenarioAssessments: Assessment[]) {
    const overrides = scenarioAssessments.flatMap((assessment) => {
      const rawValue = gradeScenarioDrafts[assessment.id]?.trim() ?? '';
      if (!rawValue) return [];
      const percentage = Number(rawValue);
      return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100
        ? [{ assessmentId: assessment.id, percentage }]
        : [{ assessmentId: assessment.id, percentage: Number.NaN }];
    });
    if (!overrides.length) {
      setError('Enter at least one hypothetical percentage before previewing.');
      return;
    }
    if (overrides.some((override) => !Number.isFinite(override.percentage))) {
      setError('Hypothetical percentages must be between 0 and 100.');
      return;
    }

    const action = 'grade-scenario-' + summary.courseOfferingId;
    setError(undefined);
    setBusyAction(action);
    void apiRequest<{ gradeSummary: GradeSummary }>(
      `/api/workspaces/${workspace.id}/grade-scenarios`,
      {
        method: 'POST',
        body: JSON.stringify({ courseOfferingId: summary.courseOfferingId, overrides }),
      },
    )
      .then((result) => {
        setGradeScenarioSummaries((summaries) => ({
          ...summaries,
          [summary.courseOfferingId]: result.gradeSummary,
        }));
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Unable to calculate this scenario.');
      })
      .finally(() => setBusyAction(undefined));
  }
  async function uploadOutline(
    selection: ActiveCourseSelection,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    const mimeType =
      file.type ||
      (extension === 'pdf'
        ? 'application/pdf'
        : extension === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'text/plain');
    setError(undefined);
    clearOutlineRecovery(selection.id);
    setBusyAction(`outline-${selection.id}`);
    let extractionJobId = '';
    try {
      const uploadResponse = await fetch(`/api/active-selections/${selection.id}/outline`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': mimeType, 'X-File-Name': file.name },
        body: file,
      });
      const uploadBody = (await uploadResponse.json().catch(() => undefined)) as
        { error?: string; extractionJob?: { id: string } } | undefined;
      if (!uploadResponse.ok || !uploadBody?.extractionJob) {
        throw new Error(
          uploadBody?.error === 'FILE_TOO_LARGE'
            ? 'This outline is larger than the 25 MB limit.'
            : uploadBody?.error === 'UNSUPPORTED_DOCUMENT_TYPE'
              ? 'Use a PDF, DOCX, or plain-text outline.'
              : 'Semora could not upload this outline.',
        );
      }
      extractionJobId = uploadBody.extractionJob.id;
      const processed = await apiRequest<{ extractionJob: { status: string } }>(
        `/api/extraction-jobs/${extractionJobId}/process`,
        {
          method: 'POST',
        },
      );
      if (processed.extractionJob.status !== 'REVIEW_REQUIRED') {
        await onReload();
        setOutlineRecoveryMessage(
          selection.id,
          extractionJobId,
          'Your outline was uploaded, but Semora could not extract a reviewable draft. No course data was changed.',
        );
        return;
      }
      await onReload();
      navigate(`/extraction-review/${extractionJobId}`);
    } catch (reason) {
      if (extractionJobId) {
        await onReload().catch(() => undefined);
        setOutlineRecoveryMessage(
          selection.id,
          extractionJobId,
          reason instanceof Error
            ? reason.message +
                ' The uploaded outline is still safe, and no course data was changed.'
            : 'Semora could not process this outline. The uploaded file is still safe, and no course data was changed.',
        );
      } else {
        setError(reason instanceof Error ? reason.message : 'Unable to upload this outline.');
      }
    } finally {
      setBusyAction(undefined);
    }
  }

  const activeOffering = catalogueCourses.find((course) => course.id === activeOfferingId);
  const activeSelection = workspace.activeCourseSelections.find(
    (selection) => selection.courseOfferingId === activeOfferingId,
  );
  const totalCredits = workspace.activeCourseSelections.reduce(
    (total, selection) => total + selection.credits,
    0,
  );
  const scheduleEntries: ScheduleEntry[] = [
    ...workspace.activeCourseSelections.flatMap((selection) =>
      selection.meetings.map((meeting, index) => ({
        key: `${selection.id}-${meeting.day}-${index}`,
        kind: 'course' as const,
        sourceId: selection.id,
        label: selection.courseCode,
        detail: `Section ${selection.sectionCode} · ${meeting.startTime}–${meeting.endTime}`,
        meeting,
      })),
    ),
    ...workspace.commitments.flatMap((commitment) =>
      commitment.meetings.map((meeting, index) => ({
        key: `${commitment.id}-${meeting.day}-${index}`,
        kind: 'commitment' as const,
        sourceId: commitment.id,
        label: commitment.name,
        detail: `${meeting.startTime}–${meeting.endTime}`,
        meeting,
      })),
    ),
  ];
  const visibleScheduleEntries = scheduleEntries.filter(
    (entry) =>
      scheduleDays.includes(entry.meeting.day as (typeof scheduleDays)[number]) &&
      timeToMinutes(entry.meeting.endTime) > scheduleStartMinutes &&
      timeToMinutes(entry.meeting.startTime) < scheduleEndMinutes,
  );
  const selectedWeek = workload?.weeklyPressure.find(
    (week) => week.weekStart === selectedWeekStart,
  );
  const dueSoonAssessments = workload
    ? [...workload.assessments]
        .filter((assessment) => assessment.dueAt !== null)
        .sort((first, second) => first.dueAt!.localeCompare(second.dueAt!))
        .slice(0, 4)
    : [];
  const mattersNowAssessments = workload
    ? [...workload.assessments]
        .sort(
          (first, second) =>
            (second.taskPressure ?? -1) - (first.taskPressure ?? -1) ||
            (first.dueAt ?? '9999-12-31').localeCompare(second.dueAt ?? '9999-12-31'),
        )
        .slice(0, 4)
    : [];
  const currentWeekStart = workload?.currentWeekPressure?.weekStart;
  const nextPressurePeak = workload
    ? ([...workload.peakPeriods]
        .filter((peak) => !currentWeekStart || peak.weekStart > currentWeekStart)
        .sort((first, second) => first.weekStart.localeCompare(second.weekStart))[0] ??
      workload.peakPeriods[0])
    : undefined;
  const upcomingPressureWeeks = workload
    ? workload.weeklyPressure
        .filter((week) => !currentWeekStart || week.weekStart >= currentWeekStart)
        .slice(0, 4)
    : [];

  return (
    <main className="planner-page active-semester-page">
      <header className="planner-heading">
        <div>
          <p className="eyebrow">LOCK / ACTIVE SEMESTER</p>
          <h1>{workspace.term.name}</h1>
          <p className="lede">{workspace.term.university.name} · Your semester is active.</p>
        </div>
        <Link className="back-link" to={`/catalogue?termId=${workspace.term.id}`}>
          Browse catalogue
        </Link>
      </header>

      <section
        className="active-semester-overview"
        aria-labelledby="active-semester-overview-title"
      >
        <div>
          <p className="eyebrow">SEMESTER OVERVIEW</p>
          <h2 id="active-semester-overview-title">Keep the active semester current.</h2>
          <p>
            Add, drop, or switch sections during Add/Drop. Your planning candidates remain
            unchanged.
          </p>
        </div>
        <div className="active-semester-summary">
          <strong>{totalCredits}</strong>
          <span>credits</span>
          <small>{workspace.activeCourseSelections.length} active courses</small>
        </div>
      </section>

      {error ? (
        <InlineState
          action={
            <button
              className="quiet-button compact-button state-inline-action-button"
              onClick={() => void retryDashboardData()}
              type="button"
            >
              Retry data
            </button>
          }
          label={error}
          tone="error"
        />
      ) : null}
      {forecastFeedback ? (
        <p className="forecast-feedback" role="status">
          {forecastFeedback}
        </p>
      ) : null}

      {isWorkloadLoading ? (
        <section className="command-center-panel command-center-state-panel">
          <p className="eyebrow">NAVIGATE / COMMAND CENTER</p>
          <h2>What matters now?</h2>
          <p>Loading the pressure forecast for your active semester.</p>
          <InlineState label="Calculating this semester’s workload…" />
        </section>
      ) : null}

      {!isWorkloadLoading && workload ? (
        <section
          className="command-center-panel"
          aria-describedby="pressure-forecast-note"
          aria-labelledby="command-center-title"
        >
          <div className="command-center-heading">
            <div>
              <p className="eyebrow">NAVIGATE / COMMAND CENTER</p>
              <h2 id="command-center-title">What matters now?</h2>
              <p>See the next hard period before it arrives.</p>
            </div>
            <span className="course-meta">
              Forecast as of {formatPressureDate(workload.asOf.slice(0, 10))}
            </span>
          </div>

          <div className="command-center-metrics">
            <article className="command-center-metric">
              <span>Today</span>
              {workload.currentDayPressure ? (
                <>
                  <strong>{workload.currentDayPressure.pressure.toFixed(1)}</strong>
                  <small>{workload.currentDayPressure.band}</small>
                </>
              ) : (
                <strong className="command-center-unknown">No data</strong>
              )}
            </article>
            <article className="command-center-metric">
              <span>This week</span>
              {workload.currentWeekPressure ? (
                <>
                  <strong>{workload.currentWeekPressure.pressure.toFixed(1)}</strong>
                  <small>{workload.currentWeekPressure.band}</small>
                </>
              ) : (
                <strong className="command-center-unknown">No data</strong>
              )}
            </article>
            <article className="command-center-metric command-center-peak-metric">
              <span>Next pressure peak</span>
              {nextPressurePeak ? (
                <>
                  <strong>{nextPressurePeak.pressure.toFixed(1)}</strong>
                  <small>
                    {formatPressureRange(nextPressurePeak.weekStart, nextPressurePeak.weekEnd)} ·{' '}
                    {nextPressurePeak.band}
                  </small>
                </>
              ) : (
                <strong className="command-center-unknown">No peak yet</strong>
              )}
            </article>
          </div>
          <aside className="pressure-forecast-note" id="pressure-forecast-note">
            <strong>How to read the forecast</strong>
            <span>
              Higher scores mean more modeled demand. Bands run from Light to Severe, using known
              assessment dates, effort, and commitments.
            </span>
          </aside>

          <div className="command-center-columns">
            <section className="command-center-card" aria-labelledby="due-soon-title">
              <div className="command-center-card-heading">
                <div>
                  <p className="eyebrow">UP NEXT</p>
                  <h3 id="due-soon-title">Due soon</h3>
                </div>
                <span className="course-meta">{dueSoonAssessments.length} shown</span>
              </div>
              {dueSoonAssessments.length ? (
                <ul className="command-center-list">
                  {dueSoonAssessments.map((assessment) => (
                    <li key={assessment.id}>
                      <div>
                        <span className="course-code">
                          {assessment.courseCode ?? 'Course unknown'}
                        </span>
                        <strong>{assessment.title}</strong>
                      </div>
                      <span>
                        {formatPressureDate(assessment.dueAt!)} ·{' '}
                        {assessment.remainingEffortHours === null
                          ? 'effort unknown'
                          : `${assessment.remainingEffortHours}h left`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="assessment-empty">No dated assessments are coming up yet.</p>
              )}
            </section>

            <section className="command-center-card" aria-labelledby="matters-now-title">
              <div className="command-center-card-heading">
                <div>
                  <p className="eyebrow">ENGINE RANKING</p>
                  <h3 id="matters-now-title">What matters now</h3>
                </div>
                <span className="course-meta">By task pressure</span>
              </div>
              {mattersNowAssessments.length ? (
                <ul className="command-center-list">
                  {mattersNowAssessments.map((assessment) => (
                    <li key={assessment.id}>
                      <div>
                        <span className="course-code">
                          {assessment.courseCode ?? 'Course unknown'}
                        </span>
                        <strong>{assessment.title}</strong>
                      </div>
                      <span>
                        {assessment.taskPressure === null
                          ? 'pressure unknown'
                          : `${assessment.taskPressure.toFixed(1)} pressure`}{' '}
                        · {assessment.preparationDays}d prep
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="assessment-empty">Add dated assessments to rank what matters.</p>
              )}
            </section>
          </div>

          <div className="command-center-forecast" aria-labelledby="upcoming-pressure-title">
            <div className="command-center-card-heading">
              <div>
                <p className="eyebrow">FORECAST</p>
                <h3 id="upcoming-pressure-title">Upcoming pressure</h3>
              </div>
              {nextPressurePeak ? (
                <span className="course-meta">
                  Peak drivers: {nextPressurePeak.driverDetails.length}
                </span>
              ) : null}
            </div>
            {upcomingPressureWeeks.length ? (
              <div className="command-center-forecast-list">
                {upcomingPressureWeeks.map((week) => (
                  <div key={week.weekStart}>
                    <span>{formatPressureRange(week.weekStart, week.weekEnd)}</span>
                    <strong>{week.pressure.toFixed(1)}</strong>
                    <small>{week.band}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="assessment-empty">No weekly pressure is available yet.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="weekly-schedule-panel" aria-labelledby="active-weekly-schedule-title">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">WEEKLY TIMETABLE</p>
            <h2 id="active-weekly-schedule-title">Your active week</h2>
          </div>
          <span className="schedule-legend">
            <span className="schedule-legend-item course-legend">Course</span>
            <span className="schedule-legend-item commitment-legend">Commitment</span>
          </span>
        </div>
        {visibleScheduleEntries.length ? (
          <div className="schedule-board">
            <div className="schedule-time-axis" aria-hidden="true">
              {scheduleAxisHours.map((hour) => (
                <span
                  key={hour}
                  style={{
                    top: `${((hour * 60 - scheduleStartMinutes) / (scheduleEndMinutes - scheduleStartMinutes)) * 100}%`,
                  }}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            {scheduleDays.map((day) => (
              <section className="schedule-day" key={day} aria-label={day}>
                <h3>{day.slice(0, 1) + day.slice(1).toLowerCase()}</h3>
                <div className="schedule-track">
                  {scheduleAxisHours.map((hour) => (
                    <span
                      className="schedule-grid-line"
                      key={hour}
                      style={{
                        top: `${((hour * 60 - scheduleStartMinutes) / (scheduleEndMinutes - scheduleStartMinutes)) * 100}%`,
                      }}
                    />
                  ))}
                  {visibleScheduleEntries
                    .filter((entry) => entry.meeting.day === day)
                    .map((entry) => (
                      <article
                        className={`schedule-block ${entry.kind === 'commitment' ? 'commitment-block' : 'course-block'}`}
                        key={entry.key}
                        style={scheduleBlockStyle(entry.meeting)}
                      >
                        <strong>{entry.label}</strong>
                        <small>{entry.detail}</small>
                      </article>
                    ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="schedule-empty">Your active timetable has no Monday–Friday blocks yet.</p>
        )}
      </section>

      <section
        className="workload-calculations-panel"
        aria-labelledby="workload-calculations-title"
      >
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">NAVIGATE / WORKLOAD</p>
            <h2 id="workload-calculations-title">What is creating demand</h2>
          </div>
          {workload ? (
            <span className="course-meta">
              {Math.round(workload.completeness * 100)}% date coverage · engine{' '}
              {workload.engineVersion}
            </span>
          ) : null}
        </div>
        {isWorkloadLoading ? <InlineState label="Calculating workload…" /> : null}
        {!isWorkloadLoading && workload ? (
          <>
            <div className="daily-pressure-heading">
              <div>
                <p className="eyebrow">NEXT DAYS</p>
                <h3>Daily pressure</h3>
              </div>
              {workload.currentDayPressure ? (
                <span className="course-meta">
                  Today {workload.currentDayPressure.pressure.toFixed(1)} ·{' '}
                  {workload.currentDayPressure.band}
                </span>
              ) : null}
            </div>
            {workload.dailyPressure.length ? (
              <div className="daily-pressure-grid" aria-label="Daily workload pressure">
                {workload.dailyPressure.slice(0, 7).map((day) => (
                  <article
                    className={`daily-pressure-day daily-pressure-${day.band.toLowerCase()}`}
                    key={day.date}
                    aria-label={`${formatPressureDate(day.date)}: ${day.pressure.toFixed(1)} ${day.band}`}
                  >
                    <time dateTime={day.date}>{formatPressureDate(day.date)}</time>
                    <strong>{day.pressure.toFixed(1)}</strong>
                    <span>{day.band}</span>
                    <small>
                      {day.estimatedDemandHours === null
                        ? 'Demand uncertain'
                        : `${day.estimatedDemandHours}h demand`}{' '}
                      · {day.drivers.length} driver{day.drivers.length === 1 ? '' : 's'}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="assessment-empty">No daily pressure is scheduled yet.</p>
            )}
            <div className="weekly-pressure-heading">
              <div>
                <p className="eyebrow">FORECAST / WEEKS</p>
                <h3>Pressure by week</h3>
              </div>
              {workload.currentWeekPressure ? (
                <span className="course-meta">
                  Current week {workload.currentWeekPressure.pressure.toFixed(1)} ·{' '}
                  {workload.currentWeekPressure.band}
                </span>
              ) : null}
            </div>
            {workload.weeklyPressure.length ? (
              <div className="weekly-pressure-list" aria-label="Weekly workload pressure">
                {workload.weeklyPressure.slice(0, 6).map((week) => (
                  <article className="weekly-pressure-row" key={week.weekStart}>
                    <div>
                      <time dateTime={week.weekStart}>
                        {formatPressureRange(week.weekStart, week.weekEnd)}
                      </time>
                      <strong>{week.pressure.toFixed(1)}</strong>
                    </div>
                    <span
                      className={`weekly-pressure-band weekly-pressure-${week.band.toLowerCase()}`}
                    >
                      {week.band}
                    </span>
                    <small>
                      {week.estimatedDemandHours === null
                        ? 'Demand uncertain'
                        : `${week.estimatedDemandHours}h demand`}{' '}
                      · {week.majorAssessmentCount} major assessment
                      {week.majorAssessmentCount === 1 ? '' : 's'} · {week.uniqueCourseCount} course
                      {week.uniqueCourseCount === 1 ? '' : 's'}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <p className="assessment-empty">No weekly pressure is scheduled yet.</p>
            )}
            <section
              className="semester-heatmap-panel"
              aria-describedby="semester-heatmap-guide"
              aria-labelledby="semester-heatmap-title"
            >
              <div className="interaction-pressure-heading">
                <div>
                  <p className="eyebrow">FULL TERM</p>
                  <h3 id="semester-heatmap-title">Semester heatmap</h3>
                </div>
                <span className="course-meta">Select a week to see its drivers</span>
              </div>
              <p className="heatmap-guide" id="semester-heatmap-guide">
                <strong>How to read the heatmap</strong>
                <span>
                  Color is supporting context only. Every cell shows its week, pressure label, and
                  numeric score; select a week to see the drivers behind a peak.
                </span>
              </p>
              {workload.weeklyPressure.length ? (
                <div className="semester-heatmap" aria-label="Semester weekly pressure heatmap">
                  {workload.weeklyPressure.map((week, index) => {
                    const isSelected = week.weekStart === selectedWeekStart;
                    return (
                      <button
                        aria-label={`Week ${index + 1}, ${formatPressureRange(week.weekStart, week.weekEnd)}, pressure ${week.band}, score ${week.pressure.toFixed(1)}`}
                        aria-pressed={isSelected}
                        className={`semester-heatmap-cell semester-heatmap-${week.band.toLowerCase()}${isSelected ? ' semester-heatmap-selected' : ''}`}
                        key={week.weekStart}
                        onClick={() => setSelectedWeekStart(week.weekStart)}
                        type="button"
                      >
                        <span>Week {index + 1}</span>
                        <strong>{week.pressure.toFixed(1)}</strong>
                        <small>{week.band}</small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="assessment-empty">No weekly pressure is available for this term.</p>
              )}
              {selectedWeek ? (
                <div className="semester-heatmap-detail">
                  <div className="semester-heatmap-detail-heading">
                    <div>
                      <p className="eyebrow">SELECTED PERIOD</p>
                      <h4>{formatPressureRange(selectedWeek.weekStart, selectedWeek.weekEnd)}</h4>
                    </div>
                    <strong>
                      {selectedWeek.pressure.toFixed(1)} · {selectedWeek.band}
                    </strong>
                  </div>
                  <p className="course-meta">
                    {selectedWeek.estimatedDemandHours === null
                      ? 'Estimated demand is uncertain.'
                      : `${selectedWeek.estimatedDemandHours}h estimated demand`}{' '}
                    · {selectedWeek.majorAssessmentCount} major assessment
                    {selectedWeek.majorAssessmentCount === 1 ? '' : 's'} ·{' '}
                    {selectedWeek.uniqueCourseCount} course
                    {selectedWeek.uniqueCourseCount === 1 ? '' : 's'} ·{' '}
                    {Math.round(workload.confidence * 100)}% confidence
                  </p>
                  {selectedWeek.driverDetails.length ? (
                    <ul className="semester-heatmap-drivers">
                      {selectedWeek.driverDetails.map((driver) => (
                        <li key={driver.id}>
                          <span>{driver.kind}</span>
                          <strong>
                            {driver.courseCode ? `${driver.courseCode} · ` : ''}
                            {driver.label}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="interaction-pressure-help">
                      No modeled demand drivers are present in this week.
                    </p>
                  )}
                </div>
              ) : null}
            </section>
            <section
              className="findings-panel workload-findings-panel"
              aria-labelledby="pressure-findings-title"
            >
              <div className="interaction-pressure-heading">
                <div>
                  <p className="eyebrow">STRUCTURED FINDINGS</p>
                  <h3 id="pressure-findings-title">What to watch</h3>
                </div>
                <span className="course-meta">
                  {workload.findings.length
                    ? `${workload.findings.length} observation${workload.findings.length === 1 ? '' : 's'}`
                    : 'No flagged patterns'}
                </span>
              </div>
              {workload.findings.length ? (
                <ul className="finding-list">
                  {[...workload.findings]
                    .sort(
                      (first, second) =>
                        pressureSeverityRank[first.severity] -
                        pressureSeverityRank[second.severity],
                    )
                    .slice(0, 6)
                    .map((finding, index) => (
                      <li key={`${finding.type}-${finding.windowStart ?? 'open'}-${index}`}>
                        <span
                          className={`finding-severity finding-severity-${finding.severity.toLowerCase()}`}
                        >
                          {finding.severity}
                        </span>
                        <div>
                          <strong>{pressureFindingTitle(finding.type)}</strong>
                          <p>{pressureFindingDescription(finding, workload)}</p>
                        </div>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="interaction-pressure-help">
                  No pressure spikes, deadline conflicts, or confidence warnings were detected.
                </p>
              )}
            </section>
            <div className="workload-calculation-summary">
              <div>
                <strong>{workload.summary.remainingEffortHours}h</strong>
                <span>remaining estimated effort</span>
              </div>
              <div>
                <strong>{workload.summary.overlappingAssessmentCount}</strong>
                <span>assessments with overlap</span>
              </div>
              <div>
                <strong>{workload.summary.commitmentPressure}</strong>
                <span>commitment pressure contribution</span>
              </div>
            </div>
            {workload.assessments.length ? (
              <div className="workload-calculation-list">
                {workload.assessments.slice(0, 4).map((assessment) => (
                  <article className="workload-calculation-row" key={assessment.id}>
                    <div>
                      <p className="course-code">{assessment.courseCode ?? 'Course unknown'}</p>
                      <h3>{assessment.title}</h3>
                      <p className="course-meta">
                        {assessment.remainingEffortHours === null
                          ? 'Effort unknown'
                          : `${assessment.remainingEffortHours}h remaining`}{' '}
                        · {assessment.preparationDays} day preparation horizon ·{' '}
                        {assessment.overlapCount
                          ? `overlaps ${assessment.overlapCount} other demand${assessment.overlapCount === 1 ? '' : 's'}`
                          : 'no preparation overlap'}
                      </p>
                    </div>
                    <div className="workload-calculation-factors">
                      <span>
                        Urgency{' '}
                        {assessment.urgency === null ? 'unknown' : assessment.urgency.toFixed(1)}
                      </span>
                      <span>
                        Importance{' '}
                        {assessment.importance === null
                          ? 'unknown'
                          : assessment.importance.toFixed(1)}
                      </span>
                      <span>
                        Compression{' '}
                        {assessment.deadlineCompression === null
                          ? 'unknown'
                          : assessment.deadlineCompression.toFixed(2)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="assessment-empty">
                No dated assessments are available for calculation yet.
              </p>
            )}
          </>
        ) : null}
      </section>

      <section className="assessments-panel" aria-labelledby="assessments-panel-title">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">NAVIGATE / ASSESSMENTS</p>
            <h2 id="assessments-panel-title">What is coming</h2>
          </div>
          <span className="course-meta">
            {assessments.filter((assessment) => assessment.status !== 'CANCELLED').length} active
            items
          </span>
        </div>

        <form
          className="assessment-entry-form"
          id="assessment-entry-form"
          onSubmit={saveAssessment}
          ref={assessmentEntryFormRef}
        >
          <div className="assessment-entry-heading">
            <div>
              <strong>{editingAssessmentId ? 'Edit assessment' : 'Add an assessment'}</strong>
              <small>
                {editingAssessmentId
                  ? 'Update the date, weight, or work progress.'
                  : 'Enter it manually if no outline is available yet.'}
              </small>
            </div>
            {editingAssessmentId ? (
              <button
                className="quiet-button compact-button"
                onClick={() => {
                  setEditingAssessmentId(undefined);
                  resetAssessmentDraft();
                }}
                type="button"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
          <div className="assessment-entry-grid">
            <label>
              Course
              <select
                disabled={Boolean(editingAssessmentId) || !workspace.activeCourseSelections.length}
                onChange={(event) =>
                  setAssessmentDraft((draft) => ({
                    ...draft,
                    activeSelectionId: event.target.value,
                  }))
                }
                value={assessmentDraft.activeSelectionId}
              >
                {workspace.activeCourseSelections.map((selection) => (
                  <option key={selection.id} value={selection.id}>
                    {selection.courseCode} · Section {selection.sectionCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assessment
              <input
                maxLength={160}
                onChange={(event) =>
                  setAssessmentDraft((draft) => ({ ...draft, title: event.target.value }))
                }
                placeholder="e.g. Assignment 2"
                required
                value={assessmentDraft.title}
              />
            </label>
            <label>
              Type
              <select
                onChange={(event) =>
                  setAssessmentDraft((draft) => ({
                    ...draft,
                    assessmentType: event.target.value as AssessmentType,
                  }))
                }
                value={assessmentDraft.assessmentType}
              >
                {[
                  ['ASSIGNMENT', 'Assignment'],
                  ['QUIZ', 'Quiz'],
                  ['PROJECT', 'Project'],
                  ['PRESENTATION', 'Presentation'],
                  ['MIDTERM', 'Midterm'],
                  ['FINAL', 'Final'],
                  ['PARTICIPATION', 'Participation'],
                  ['OTHER', 'Other'],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date
              <input
                onChange={(event) =>
                  setAssessmentDraft((draft) => ({ ...draft, dueDate: event.target.value }))
                }
                onInput={(event) => {
                  const dueDate = event.currentTarget.value;
                  setAssessmentDraft((draft) => ({ ...draft, dueDate }));
                }}
                type="date"
                value={assessmentDraft.dueDate}
              />
            </label>
            <label>
              <span>Weight %</span>
              <input
                max="100"
                min="0"
                onChange={(event) =>
                  setAssessmentDraft((draft) => ({
                    ...draft,
                    weightPercentage: event.target.value,
                  }))
                }
                step="0.1"
                type="number"
                value={assessmentDraft.weightPercentage}
              />
              {editingAssessmentId &&
              assessments.find((assessment) => assessment.id === editingAssessmentId)
                ?.weightIsDerived ? (
                <small className="assessment-weight-hint">
                  Equal share by default. Changing it switches this category to individual weights.
                </small>
              ) : null}
            </label>
            <label>
              Work progress %
              <input
                max="100"
                min="0"
                onChange={(event) =>
                  setAssessmentDraft((draft) => ({
                    ...draft,
                    progressPercentage: event.target.value,
                  }))
                }
                step="1"
                type="number"
                value={assessmentDraft.progressPercentage}
              />
            </label>
            <label>
              Your effort estimate (hours)
              <input
                max="168"
                min="0"
                onChange={(event) =>
                  setAssessmentDraft((draft) => ({
                    ...draft,
                    personalEffortHours: event.target.value,
                  }))
                }
                placeholder="Type default"
                step="0.5"
                type="number"
                value={assessmentDraft.personalEffortHours}
              />
            </label>
          </div>
          <div className="assessment-entry-actions">
            <button
              disabled={Boolean(busyAction) || !assessmentDraft.activeSelectionId}
              type="submit"
            >
              {busyAction === 'assessment-create'
                ? 'Adding…'
                : busyAction === 'assessment-edit'
                  ? 'Saving…'
                  : editingAssessmentId
                    ? 'Save assessment'
                    : 'Add assessment'}
            </button>
            <small>
              Leave effort blank to use the outline estimate or Semora generic type default. This
              affects workload planning, not grade weight.
            </small>
          </div>
        </form>

        {!isAssessmentsLoading && gradeSummaries.length ? (
          <section className="grade-performance-panel" aria-labelledby="grade-performance-title">
            <div className="panel-heading-row">
              <div>
                <p className="eyebrow">NAVIGATE / GRADES</p>
                <h2 id="grade-performance-title">How you are performing</h2>
                <p className="panel-description">
                  Recorded scores show performance on completed graded work; missing scores are not
                  treated as zero.
                </p>
              </div>
              <span className="course-meta">{gradeSummaries.length} course summaries</span>
            </div>
            <div className="grade-performance-grid">
              {gradeSummaries.map((summary) => {
                const scenarioAssessments = assessments.filter(
                  (assessment) =>
                    assessment.courseOfferingId === summary.courseOfferingId &&
                    assessment.score === null &&
                    assessment.effectiveWeightPercentage !== null &&
                    !['CANCELLED', 'DROPPED', 'EXCUSED'].includes(assessment.status),
                );
                const scenarioSummary = gradeScenarioSummaries[summary.courseOfferingId];
                return (
                  <article className="grade-performance-card" key={summary.courseOfferingId}>
                    <div className="grade-performance-heading">
                      <div>
                        <span className="course-badge">{summary.courseCode}</span>
                        <h3>{summary.courseTitle}</h3>
                      </div>
                      <span className="grade-performance-mode">
                        {summary.gradingMode.toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grade-performance-main">
                      <strong>
                        {summary.currentPerformance === null
                          ? 'No grade yet'
                          : summary.currentPerformance.toFixed(1) + '%'}
                      </strong>
                      <small>
                        {summary.currentPerformance === null
                          ? 'Enter a recorded score to calculate current performance.'
                          : 'Current performance'}
                      </small>
                    </div>
                    <p className="grade-performance-basis">
                      {summary.gradedWeight === null
                        ? 'Current performance is unavailable from the recorded grading structure.'
                        : 'Based on ' + summary.gradedWeight.toFixed(1) + '% of course graded.'}
                    </p>
                    {summary.categories.map((category) => (
                      <p className="grade-rule-note" key={category.categoryId}>
                        <strong>{category.name}</strong>{' '}
                        {category.aggregationRule === 'EQUAL_MEAN'
                          ? 'Equal weight across ' +
                            category.assessmentCount +
                            ' assessment' +
                            (category.assessmentCount === 1 ? '' : 's') +
                            '.'
                          : category.aggregationRule === 'POINTS_WEIGHTED_MEAN'
                            ? 'Points-weighted across ' +
                              category.assessmentCount +
                              ' assessment' +
                              (category.assessmentCount === 1 ? '' : 's') +
                              '.'
                            : category.aggregationRule === 'EXPLICIT_WEIGHTS'
                              ? 'Individual assessment weights.'
                              : category.aggregationRule === 'BEST_N'
                                ? 'Best ' +
                                  (category.ruleParameterN ?? '?') +
                                  ' of ' +
                                  category.assessmentCount +
                                  '.'
                                : 'Drop lowest ' +
                                  (category.ruleParameterN ?? '?') +
                                  ' of ' +
                                  category.assessmentCount +
                                  '.'}{' '}
                        {category.aggregationRule === 'BEST_N' ||
                        category.aggregationRule === 'DROP_LOWEST_N'
                          ? category.droppedAssessmentCount > 0
                            ? category.droppedAssessmentCount +
                              ' lowest graded result' +
                              (category.droppedAssessmentCount === 1 ? '' : 's') +
                              ' currently excluded.'
                            : category.gradedAssessmentCount > 0
                              ? 'Provisional: all graded results currently count.'
                              : 'No graded results yet.'
                          : null}
                      </p>
                    ))}
                    <p className="grade-performance-grade">
                      {summary.currentGrade
                        ? 'Current equivalent: ' + summary.currentGrade
                        : summary.gradingMode === 'ABSOLUTE'
                          ? summary.currentPerformance === null
                            ? 'Letter grade will appear after a graded result.'
                            : 'Letter grade unavailable — thresholds not confirmed.'
                          : summary.gradingMode === 'RELATIVE'
                            ? 'Letter grade is not predicted for relative grading.'
                            : 'Letter grade unavailable until the grading method is confirmed.'}
                    </p>
                    {summary.targetAnalyses.length ? (
                      <div className="grade-targets" aria-label="Grade targets">
                        <div className="grade-targets-heading">
                          <span>Target</span>
                          <span>Required on remaining</span>
                        </div>
                        {summary.targetAnalyses.map((target) => (
                          <div className="grade-target-row" key={target.target}>
                            <strong>{target.target}</strong>
                            <span>
                              {target.secured
                                ? 'Already secured'
                                : target.reachable
                                  ? target.requiredRemainingAverage === null
                                    ? '—'
                                    : target.requiredRemainingAverage.toFixed(1) + '% average'
                                  : target.requiredRemainingAverage === null
                                    ? 'Not reachable'
                                    : target.requiredRemainingAverage.toFixed(1) +
                                      '% — not reachable'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div
                      className="grade-remaining-assessments"
                      aria-label={'Remaining assessments for ' + summary.courseCode}
                    >
                      <div className="grade-remaining-heading">
                        <strong>Remaining assessments</strong>
                        <span>
                          {summary.remainingAssessments.length
                            ? summary.remainingAssessments.length + ' to go'
                            : 'Nothing pending'}
                        </span>
                      </div>
                      {summary.remainingAssessments.length ? (
                        <div className="grade-remaining-list">
                          {summary.remainingAssessments.map((assessment) => (
                            <div className="grade-remaining-row" key={assessment.assessmentId}>
                              <div>
                                <strong>{assessment.title}</strong>
                                <small>
                                  {assessment.assessmentType.toLowerCase()} ·{' '}
                                  {assessment.dueDate
                                    ? assessment.dueDate.slice(5)
                                    : 'Date unknown'}{' '}
                                  · {formatAssessmentWeight(assessment.weightPercentage)}
                                </small>
                              </div>
                              <span>
                                {assessment.status === 'SUBMITTED'
                                  ? 'Awaiting grade'
                                  : assessment.status === 'MISSING'
                                    ? 'Missing score'
                                    : 'Upcoming'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="grade-remaining-empty">
                          No ungraded assessments are recorded for this course.
                        </p>
                      )}
                    </div>
                    <div className="grade-performance-stats">
                      <div>
                        <span>Weighted points earned</span>
                        <strong>
                          {summary.weightedPointsEarned === null
                            ? '—'
                            : summary.weightedPointsEarned.toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span>Graded</span>
                        <strong>
                          {summary.gradedWeight === null
                            ? '—'
                            : summary.gradedWeight.toFixed(1) + '%'}
                        </strong>
                      </div>
                      <div>
                        <span>Remaining</span>
                        <strong>
                          {summary.remainingWeight === null
                            ? '—'
                            : summary.remainingWeight.toFixed(1) + '%'}
                        </strong>
                      </div>
                    </div>
                    {summary.gradingMode === 'ABSOLUTE' && scenarioAssessments.length ? (
                      <div
                        className="grade-scenario"
                        aria-label={'What-if scenario for ' + summary.courseCode}
                      >
                        <div className="grade-scenario-heading">
                          <div>
                            <strong>What if?</strong>
                            <span>Temporary preview; real scores stay unchanged.</span>
                          </div>
                          {scenarioSummary ? (
                            <button
                              className="text-button"
                              onClick={() =>
                                setGradeScenarioSummaries((summaries) => {
                                  const next = { ...summaries };
                                  delete next[summary.courseOfferingId];
                                  return next;
                                })
                              }
                              type="button"
                            >
                              Clear preview
                            </button>
                          ) : null}
                        </div>
                        <div className="grade-scenario-inputs">
                          {scenarioAssessments.map((assessment) => (
                            <label key={assessment.id}>
                              {assessment.title}
                              <span>
                                <input
                                  aria-label={'Hypothetical percentage for ' + assessment.title}
                                  disabled={Boolean(busyAction)}
                                  max="100"
                                  min="0"
                                  onChange={(event) =>
                                    setGradeScenarioDrafts((drafts) => ({
                                      ...drafts,
                                      [assessment.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="—"
                                  step="0.1"
                                  type="number"
                                  value={gradeScenarioDrafts[assessment.id] ?? ''}
                                />
                                %
                              </span>
                            </label>
                          ))}
                        </div>
                        <button
                          className="secondary-button compact-button"
                          disabled={Boolean(busyAction)}
                          onClick={() => runGradeScenario(summary, scenarioAssessments)}
                          type="button"
                        >
                          {busyAction === 'grade-scenario-' + summary.courseOfferingId
                            ? 'Calculating…'
                            : 'Preview scenario'}
                        </button>
                        {scenarioSummary ? (
                          <div className="grade-scenario-result">
                            <span>Projected performance</span>
                            <strong>
                              {scenarioSummary.currentPerformance === null
                                ? 'Unavailable'
                                : scenarioSummary.currentPerformance.toFixed(1) + '%'}
                            </strong>
                            <small>
                              {scenarioSummary.currentGrade
                                ? 'Projected equivalent: ' + scenarioSummary.currentGrade
                                : 'No letter-grade projection is available for this grading mode.'}
                              {scenarioSummary.gradedWeight === null
                                ? ''
                                : ' Based on ' +
                                  scenarioSummary.gradedWeight.toFixed(1) +
                                  '% graded.'}
                            </small>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {summary.gradingMode === 'RELATIVE' ? (
                      summary.relativeStatistics.length ? (
                        <div className="grade-relative" aria-label="Relative grade context">
                          <div className="grade-relative-heading">
                            <strong>Relative context</strong>
                            <span>Recorded scores compared with entered class statistics.</span>
                          </div>
                          {summary.relativeStatistics.map((statistic) => (
                            <div className="grade-relative-row" key={statistic.assessmentId}>
                              <strong>{statistic.title}</strong>
                              <span>
                                {statistic.score.toFixed(1)}% vs {statistic.mean.toFixed(1)}% mean ·{' '}
                                {statistic.differenceFromMean >= 0 ? '+' : ''}
                                {statistic.differenceFromMean.toFixed(1)} points
                              </span>
                              <small>
                                {statistic.zScore === null
                                  ? 'Standard deviation unavailable; z-score not calculated.'
                                  : (statistic.zScore >= 0 ? '+' : '') +
                                    statistic.zScore.toFixed(2) +
                                    ' SD from mean'}
                              </small>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="grade-relative-empty">
                          Relative grading detected. Add a recorded score and class statistics to
                          see score-vs-mean context; no letter grade is predicted.
                        </p>
                      )
                    ) : null}
                    {summary.warnings.length ? (
                      <p className="grade-performance-warning">{summary.warnings[0]}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
        {!isAssessmentsLoading && assessments.length ? (
          <div className="assessment-list-toolbar">
            <div className="assessment-list-toolbar-heading">
              <div>
                <strong>Find an assessment</strong>
                <small>Search by course, name, type, or number.</small>
              </div>
              <span>
                Showing {Math.min(visibleAssessments.length, filteredAssessments.length)} of{' '}
                {filteredAssessments.length}
              </span>
            </div>
            <div className="assessment-filter-grid">
              <label>
                Search
                <input
                  aria-label="Search assessments"
                  onChange={(event) => {
                    setAssessmentSearch(event.target.value);
                    setAssessmentVisibleCount(ASSESSMENT_PAGE_SIZE);
                  }}
                  placeholder="e.g. CS 370, assignment 2, quiz"
                  type="search"
                  value={assessmentSearch}
                />
              </label>
              <label>
                Course
                <select
                  aria-label="Filter assessments by course"
                  onChange={(event) => {
                    setAssessmentCourseFilter(event.target.value);
                    setAssessmentVisibleCount(ASSESSMENT_PAGE_SIZE);
                  }}
                  value={assessmentCourseFilter}
                >
                  <option value="">All courses</option>
                  {workspace.activeCourseSelections.map((selection) => (
                    <option key={selection.id} value={selection.id}>
                      {selection.courseCode} · {selection.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select
                  aria-label="Filter assessments by type"
                  onChange={(event) => {
                    setAssessmentTypeFilter(event.target.value as AssessmentType | '');
                    setAssessmentVisibleCount(ASSESSMENT_PAGE_SIZE);
                  }}
                  value={assessmentTypeFilter}
                >
                  <option value="">All types</option>
                  <option value="ASSIGNMENT">Assignments</option>
                  <option value="QUIZ">Quizzes</option>
                  <option value="PROJECT">Projects</option>
                  <option value="PRESENTATION">Presentations</option>
                  <option value="MIDTERM">Midterms</option>
                  <option value="FINAL">Finals</option>
                  <option value="PARTICIPATION">Participation</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              {hasAssessmentFilters ? (
                <button
                  className="quiet-button compact-button assessment-filter-clear"
                  onClick={() => {
                    setAssessmentSearch('');
                    setAssessmentCourseFilter('');
                    setAssessmentTypeFilter('');
                    setAssessmentVisibleCount(ASSESSMENT_PAGE_SIZE);
                  }}
                  type="button"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {isAssessmentsLoading ? <InlineState label="Loading assessments…" /> : null}
        {!isAssessmentsLoading && !assessments.length ? (
          <p className="assessment-empty">
            No assessments yet. Add one manually or verify a course outline to build your timeline.
          </p>
        ) : null}
        {!isAssessmentsLoading && assessments.length && !filteredAssessments.length ? (
          <div className="assessment-filter-empty">
            <p>No assessments match these filters.</p>
            <button
              className="quiet-button compact-button"
              onClick={() => {
                setAssessmentSearch('');
                setAssessmentCourseFilter('');
                setAssessmentTypeFilter('');
                setAssessmentVisibleCount(ASSESSMENT_PAGE_SIZE);
              }}
              type="button"
            >
              Clear filters
            </button>
          </div>
        ) : null}
        {!isAssessmentsLoading && filteredAssessments.length ? (
          <div className="assessment-timeline">
            {visibleAssessments.map((assessment) => {
              const assessmentSummary = gradeSummaries.find(
                (summary) => summary.courseOfferingId === assessment.courseOfferingId,
              );
              const isRelativeCourse = assessmentSummary?.gradingMode === 'RELATIVE';
              const statisticsDraft = classStatisticsDraftFor(assessment);
              const isCancelled = assessment.status === 'CANCELLED';
              const isDone = assessment.workStatus === 'DONE';
              const effortLabel =
                assessment.effortSource === 'PERSONAL_ESTIMATE'
                  ? 'Your estimate'
                  : assessment.effortSource === 'OUTLINE_ESTIMATE'
                    ? 'From outline'
                    : assessment.effortSource === 'GENERIC_DEFAULT'
                      ? `Semora default for ${assessment.assessmentType.toLowerCase()}`
                      : 'Effort unknown';
              return (
                <article
                  className={`assessment-timeline-item${isCancelled ? ' assessment-cancelled' : ''}`}
                  key={assessment.id}
                >
                  <div className="assessment-timeline-date">
                    <strong>{assessment.dueDate ? assessment.dueDate.slice(5) : 'TBA'}</strong>
                    <small>{assessment.dueDate ? 'due date' : 'date unknown'}</small>
                  </div>
                  <div className="assessment-timeline-content">
                    <div className="assessment-timeline-heading">
                      <div>
                        <span className="course-badge">{assessment.courseCode}</span>
                        <h3>{assessment.title}</h3>
                      </div>
                      <span
                        className={`assessment-status status-${assessment.workStatus.toLowerCase()}`}
                      >
                        {isCancelled
                          ? 'Cancelled'
                          : isDone
                            ? 'Work done'
                            : assessment.workStatus === 'IN_PROGRESS'
                              ? 'In progress'
                              : 'Not started'}
                      </span>
                    </div>
                    <p className="assessment-meta">
                      {assessment.assessmentType.toLowerCase()} ·{' '}
                      {formatAssessmentWeight(assessment.effectiveWeightPercentage)} ·{' '}
                      {assessment.sourceType === 'USER_ENTERED'
                        ? 'Entered by you'
                        : 'From course outline'}
                    </p>
                    <p className="assessment-effort-note">
                      {assessment.estimatedEffortHours === null
                        ? effortLabel
                        : `${assessment.estimatedEffortHours}h · ${effortLabel}`}
                    </p>
                    {assessment.progressPercentage !== null ? (
                      <div
                        className="assessment-progress"
                        aria-label={`${assessment.progressPercentage}% work progress`}
                      >
                        <span style={{ width: `${assessment.progressPercentage}%` }} />
                      </div>
                    ) : null}
                    <div
                      className="assessment-score-entry"
                      aria-label={'Score for ' + assessment.title}
                    >
                      <label>
                        Score
                        <input
                          aria-label={'Score for ' + assessment.title}
                          disabled={isCancelled || Boolean(busyAction)}
                          max={
                            scoreModeFor(assessment) === 'POINTS'
                              ? (assessment.pointsPossible ?? undefined)
                              : 100
                          }
                          min="0"
                          onChange={(event) =>
                            setScoreDrafts((drafts) => ({
                              ...drafts,
                              [assessment.id]: event.target.value,
                            }))
                          }
                          step="0.1"
                          type="number"
                          value={scoreDraftFor(assessment)}
                        />
                      </label>
                      <label>
                        Format
                        <select
                          disabled={isCancelled || Boolean(busyAction)}
                          onChange={(event) =>
                            setScoreModes((modes) => ({
                              ...modes,
                              [assessment.id]: event.target.value as AssessmentScoreMode,
                            }))
                          }
                          value={scoreModeFor(assessment)}
                        >
                          <option disabled={assessment.pointsPossible === null} value="POINTS">
                            Points{assessment.pointsPossible === null ? ' unavailable' : ''}
                          </option>
                          <option value="PERCENTAGE">Percentage</option>
                        </select>
                      </label>
                      <div className="assessment-score-actions">
                        <small>
                          {assessment.score
                            ? 'Recorded score · updates grade calculations'
                            : 'No score entered'}
                        </small>
                        <button
                          className="secondary-button compact-button"
                          disabled={isCancelled || Boolean(busyAction)}
                          onClick={() => saveAssessmentScore(assessment)}
                          type="button"
                        >
                          {busyAction === 'assessment-score-' + assessment.id
                            ? 'Saving…'
                            : 'Save score'}
                        </button>
                        {assessment.score ? (
                          <button
                            className="quiet-button compact-button"
                            disabled={Boolean(busyAction)}
                            onClick={() => clearAssessmentScore(assessment)}
                            type="button"
                          >
                            {busyAction === 'assessment-score-clear-' + assessment.id
                              ? 'Clearing…'
                              : 'Clear'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {isRelativeCourse ? (
                      <div className="assessment-relative-entry">
                        <div className="assessment-relative-heading">
                          <strong>Class statistics</strong>
                          <span>Optional context for relative grading.</span>
                        </div>
                        <div className="assessment-relative-inputs">
                          <label>
                            Mean
                            <input
                              aria-label={'Class mean for ' + assessment.title}
                              disabled={isCancelled || Boolean(busyAction)}
                              max="100"
                              min="0"
                              onChange={(event) =>
                                setClassStatisticsDrafts((drafts) => ({
                                  ...drafts,
                                  [assessment.id]: {
                                    ...statisticsDraft,
                                    mean: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Required"
                              step="0.1"
                              type="number"
                              value={statisticsDraft.mean}
                            />
                          </label>
                          <label>
                            Median
                            <input
                              aria-label={'Class median for ' + assessment.title}
                              disabled={isCancelled || Boolean(busyAction)}
                              max="100"
                              min="0"
                              onChange={(event) =>
                                setClassStatisticsDrafts((drafts) => ({
                                  ...drafts,
                                  [assessment.id]: {
                                    ...statisticsDraft,
                                    median: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Optional"
                              step="0.1"
                              type="number"
                              value={statisticsDraft.median}
                            />
                          </label>
                          <label>
                            Standard deviation
                            <input
                              aria-label={'Class standard deviation for ' + assessment.title}
                              disabled={isCancelled || Boolean(busyAction)}
                              max="100"
                              min="0"
                              onChange={(event) =>
                                setClassStatisticsDrafts((drafts) => ({
                                  ...drafts,
                                  [assessment.id]: {
                                    ...statisticsDraft,
                                    standardDeviation: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Optional"
                              step="0.1"
                              type="number"
                              value={statisticsDraft.standardDeviation}
                            />
                          </label>
                        </div>
                        <div className="assessment-relative-actions">
                          <button
                            className="secondary-button compact-button"
                            disabled={isCancelled || Boolean(busyAction)}
                            onClick={() => saveClassStatistics(assessment)}
                            type="button"
                          >
                            {busyAction === 'assessment-class-statistics-' + assessment.id
                              ? 'Saving…'
                              : 'Save statistics'}
                          </button>
                          {assessment.classStatistics ? (
                            <button
                              className="quiet-button compact-button"
                              disabled={Boolean(busyAction)}
                              onClick={() => clearClassStatistics(assessment)}
                              type="button"
                            >
                              {busyAction === 'assessment-class-statistics-clear-' + assessment.id
                                ? 'Clearing…'
                                : 'Clear'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="assessment-actions">
                      {!isCancelled && !isDone ? (
                        <button
                          className="secondary-button compact-button"
                          disabled={Boolean(busyAction)}
                          onClick={() => markAssessmentDone(assessment)}
                          type="button"
                        >
                          {busyAction === `assessment-done-${assessment.id}`
                            ? 'Updating…'
                            : 'Mark work done'}
                        </button>
                      ) : null}
                      {!isCancelled ? (
                        <button
                          aria-label={`Edit ${assessment.title}`}
                          className="secondary-button compact-button"
                          disabled={Boolean(busyAction)}
                          onClick={() => editAssessment(assessment)}
                          type="button"
                        >
                          Edit
                        </button>
                      ) : null}
                      {!isCancelled ? (
                        <button
                          className="danger-button compact-button"
                          disabled={Boolean(busyAction)}
                          onClick={() => cancelAssessment(assessment)}
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        {!isAssessmentsLoading && filteredAssessments.length > visibleAssessments.length ? (
          <div className="assessment-list-pagination">
            <small>
              Showing {visibleAssessments.length} of {filteredAssessments.length} matching
              assessments
            </small>
            <button
              className="secondary-button compact-button"
              onClick={() =>
                setAssessmentVisibleCount((count) =>
                  Math.min(count + ASSESSMENT_PAGE_SIZE, filteredAssessments.length),
                )
              }
              type="button"
            >
              Load more
            </button>
          </div>
        ) : !isAssessmentsLoading && filteredAssessments.length > ASSESSMENT_PAGE_SIZE ? (
          <div className="assessment-list-pagination">
            <small>Showing all {filteredAssessments.length} matching assessments</small>
            <button
              className="quiet-button compact-button"
              onClick={() => setAssessmentVisibleCount(ASSESSMENT_PAGE_SIZE)}
              type="button"
            >
              Show fewer
            </button>
          </div>
        ) : null}
      </section>

      <section className="active-courses-panel" aria-labelledby="active-courses-title">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">ACTIVE COURSES</p>
            <h2 id="active-courses-title">What you are taking</h2>
          </div>
          <span className="course-meta">Add/Drop ready</span>
        </div>
        {workspace.activeCourseSelections.length ? (
          <div className="active-course-grid">
            {workspace.activeCourseSelections.map((selection) => (
              <article className="active-course-card" key={selection.id}>
                <div>
                  <p className="course-code">{selection.courseCode}</p>
                  <h3>{selection.title}</h3>
                  <p className="course-meta">
                    Section {selection.sectionCode} · {selection.credits} credits
                  </p>
                  <p className="meeting-summary">
                    {selection.meetings.map(formatMeeting).join(' · ') || 'Timing TBA'}
                  </p>
                  <p className="course-meta">{selection.instructor ?? 'Instructor not provided'}</p>
                </div>
                <div className="active-course-actions">
                  <button
                    className="secondary-button compact-button"
                    disabled={Boolean(busyAction)}
                    onClick={() => {
                      setCourseSearch(selection.courseCode);
                      setAppliedCourseSearch(selection.courseCode);
                      setActiveOfferingId(selection.courseOfferingId);
                    }}
                    type="button"
                  >
                    Switch section
                  </button>
                  <label className="secondary-button compact-button file-button">
                    Upload outline
                    <input
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      disabled={Boolean(busyAction)}
                      onChange={(event) => void uploadOutline(selection, event)}
                      type="file"
                    />
                  </label>
                  {selection.state?.outline?.extractionJob?.status === 'REVIEW_REQUIRED' ? (
                    <button
                      className="secondary-button compact-button"
                      disabled={Boolean(busyAction)}
                      onClick={() =>
                        navigate(
                          `/extraction-review/${selection.state?.outline?.extractionJob?.id}`,
                        )
                      }
                      type="button"
                    >
                      Review extraction
                    </button>
                  ) : null}
                  {selection.state?.outline?.extractionJob?.status === 'VERIFIED' ? (
                    <span className="outline-status">Outline verified</span>
                  ) : null}
                  {selection.state?.outline?.extractionJob?.status === 'FAILED' ? (
                    <div className="outline-recovery" role="alert">
                      <strong>Outline processing needs attention</strong>
                      <p>
                        Your file is still uploaded, but no course data was changed. Retry the
                        extraction or add assessments manually below.
                      </p>
                      <div className="outline-recovery-actions">
                        <button
                          className="secondary-button compact-button"
                          disabled={Boolean(busyAction)}
                          onClick={() => void retryOutlineExtraction(selection)}
                          type="button"
                        >
                          {busyAction === 'outline-retry-' + selection.id
                            ? 'Retrying…'
                            : 'Retry extraction'}
                        </button>
                        <button
                          className="quiet-button compact-button"
                          disabled={Boolean(busyAction)}
                          onClick={() => enterAssessmentManually(selection.id)}
                          type="button"
                        >
                          Enter manually
                        </button>
                      </div>
                      {outlineRecovery[selection.id]?.message ? (
                        <small>{outlineRecovery[selection.id]?.message}</small>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    className="danger-button compact-button"
                    disabled={Boolean(busyAction)}
                    onClick={() => dropCourse(selection)}
                    type="button"
                  >
                    Drop course
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="selected-courses-empty">
            No active courses. Add one below during Add/Drop.
          </p>
        )}
      </section>

      <section className="active-course-browser" aria-labelledby="active-course-browser-title">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">ADD OR SWITCH</p>
            <h2 id="active-course-browser-title">Find a course section</h2>
          </div>
          <Link className="back-link" to={`/catalogue?termId=${workspace.term.id}`}>
            Full catalogue
          </Link>
        </div>
        <form className="planner-search" onSubmit={searchCourses}>
          <label className="sr-only" htmlFor="active-course-search">
            Search active course sections
          </label>
          <input
            id="active-course-search"
            onChange={(event) => setCourseSearch(event.target.value)}
            placeholder="Search by code or title"
            value={courseSearch}
          />
          <button disabled={!courseSearch.trim()} type="submit">
            Search
          </button>
        </form>
        {isCatalogueLoading ? <p className="catalogue-message">Searching courses…</p> : null}
        {!isCatalogueLoading && appliedCourseSearch && !catalogueCourses.length ? (
          <p className="catalogue-message">No courses match “{appliedCourseSearch}”.</p>
        ) : null}
        <div className="planner-course-results">
          {catalogueCourses.map((course) => (
            <button
              className={
                course.id === activeOfferingId ? 'planner-course-row active' : 'planner-course-row'
              }
              key={course.id}
              onClick={() => setActiveOfferingId(course.id)}
              type="button"
            >
              <span>
                <strong>{course.courseCode}</strong>
                <span>{course.title}</span>
              </span>
              <small>
                {course.credits} cr · {course.sections.length} sections
              </small>
            </button>
          ))}
        </div>
        {activeOffering ? (
          <div className="active-section-picker">
            <div className="panel-heading-row">
              <div>
                <p className="eyebrow">SECTION OPTIONS</p>
                <h3>{activeOffering.courseCode}</h3>
                <p className="course-meta">{activeOffering.title}</p>
              </div>
              <span className="credit-badge">{activeOffering.credits} credits</span>
            </div>
            <div className="section-option-list">
              {activeOffering.sections.map((section) => {
                const isSelected = activeSelection?.sectionId === section.id;
                return (
                  <article
                    className={isSelected ? 'section-option selected' : 'section-option'}
                    key={section.id}
                  >
                    <div>
                      <h3>Section {section.sectionCode}</h3>
                      <p>{section.instructor ?? 'Instructor not provided'}</p>
                      <p className="meeting-summary">
                        {section.meetings.map(formatMeeting).join(' · ') || 'Timing TBA'}
                      </p>
                    </div>
                    <button
                      className={isSelected ? 'secondary-button compact-button' : 'compact-button'}
                      disabled={Boolean(busyAction) || isSelected}
                      onClick={() => chooseSection(section.id)}
                      type="button"
                    >
                      {isSelected
                        ? 'Selected'
                        : activeSelection
                          ? 'Switch to this section'
                          : 'Add course'}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
