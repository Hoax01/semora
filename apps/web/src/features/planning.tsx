import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function findingTitle(type: string) {
  const titles: Record<string, string> = {
    TIMETABLE_CLASH: 'Timetable clash',
    COMMITMENT_CLASH: 'Hard commitment clash',
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
  return `${better} has ${metric.label.toLowerCase()} ${formatMetric(tradeoff.delta)} better than ${worse}.`;
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
          <p className="catalogue-message">Loading available terms…</p>
        ) : null}
        {error ? <p className="form-error setup-message">{error}</p> : null}
        {universities ? (
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
  const [preferenceDraft, setPreferenceDraft] = useState<PreferenceDraft>(defaultPreferenceDraft);
  const [busyAction, setBusyAction] = useState<string>();
  const [error, setError] = useState<string>();

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

  useEffect(() => {
    setEditedName(selectedCandidate?.name ?? '');
  }, [selectedCandidate?.id, selectedCandidate?.name]);

  useEffect(() => {
    setPreferenceDraft(preferenceDraftFrom(workspace?.preferences ?? null));
  }, [workspace?.preferences?.updatedAt]);

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
    setCommitmentDraft((current) => ({
      ...current,
      meetings: current.meetings.map((meeting, meetingIndex) =>
        meetingIndex === index ? { ...meeting, [field]: value } : meeting,
      ),
    }));
  }

  function addCommitmentMeeting() {
    setCommitmentDraft((current) => ({
      ...current,
      meetings: [
        ...current.meetings,
        { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00' },
      ],
    }));
  }

  function removeCommitmentMeeting(index: number) {
    setCommitmentDraft((current) => ({
      ...current,
      meetings: current.meetings.filter((_, meetingIndex) => meetingIndex !== index),
    }));
  }

  function saveCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !commitmentDraft.name.trim()) return;
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
    });
  }

  function removeCommitment(commitment: Commitment) {
    if (!window.confirm(`Remove ${commitment.name} from this semester?`)) return;
    void runMutation('delete-commitment', async () => {
      await apiRequest(`/api/commitments/${commitment.id}`, { method: 'DELETE' });
      if (commitmentDraft.id === commitment.id) setCommitmentDraft(emptyCommitmentDraft());
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
  const conflictIds = new Set(
    candidateValidation?.clashes.flatMap((clash) => [clash.first.id, clash.second.id]) ?? [],
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
        <p className="catalogue-message">Loading your semester workspace…</p>
      </main>
    );

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
                + New option
              </button>
            </form>
          </section>

          {candidateComparison && candidateComparison.candidates.length > 1 ? (
            <section className="comparison-panel" aria-labelledby="comparison-title">
              <div className="panel-heading-row">
                <div>
                  <p className="eyebrow">CANDIDATE COMPARISON</p>
                  <h2 id="comparison-title">Which trade-off fits you?</h2>
                </div>
                <span className="course-meta">Differences under 0.5 stay neutral</span>
              </div>
              <div className="comparison-candidate-grid">
                {candidateComparison.candidates.map((candidate) => (
                  <article className="comparison-candidate" key={candidate.candidateId}>
                    <div>
                      <h3>{candidate.name}</h3>
                      <span
                        className={
                          candidate.analysis.validity.valid ? 'valid-label' : 'invalid-label'
                        }
                      >
                        {candidate.analysis.validity.valid
                          ? 'Valid timetable'
                          : 'Needs timetable fixes'}
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
                  </article>
                ))}
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
                  </article>
                  <article>
                    <span>Continuous load</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.continuousLoad)}</strong>
                  </article>
                  <article>
                    <span>Project load</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.projectLoad)}</strong>
                  </article>
                  <article>
                    <span>Exam load</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.examLoad)}</strong>
                  </article>
                  <article>
                    <span>Assessment fragmentation</span>
                    <strong>
                      {formatMetric(candidateAnalysis.metrics.assessmentFragmentation)}
                    </strong>
                  </article>
                  <article>
                    <span>Schedule quality</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.scheduleQuality)}</strong>
                  </article>
                  <article>
                    <span>Commitment compatibility</span>
                    <strong>
                      {formatMetric(candidateAnalysis.metrics.commitmentCompatibility)}
                    </strong>
                  </article>
                  <article>
                    <span>Interest fit</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.interestFit)}</strong>
                  </article>
                  <article>
                    <span>Career fit</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.careerFit)}</strong>
                  </article>
                  <article>
                    <span>Balance</span>
                    <strong>{formatMetric(candidateAnalysis.metrics.balance)}</strong>
                  </article>
                </div>
                <p className="interaction-pressure-help">
                  Metrics are preliminary and reflect the currently known schedule, workload
                  profiles, commitments, and course ratings.
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
              <div className="intelligence-notes">
                {candidateAnalysis.schedule.longDays.length ? (
                  <p>
                    <strong>Long day:</strong> {formatDayList(candidateAnalysis.schedule.longDays)}{' '}
                    reaches at least six hours of class time.
                  </p>
                ) : null}
                {candidateAnalysis.schedule.earlyClassMinutes ? (
                  <p>
                    <strong>Early classes:</strong>{' '}
                    {formatMinutes(candidateAnalysis.schedule.earlyClassMinutes)} begin before
                    09:00.
                  </p>
                ) : null}
                {candidateAnalysis.schedule.lateClassMinutes ? (
                  <p>
                    <strong>Late classes:</strong>{' '}
                    {formatMinutes(candidateAnalysis.schedule.lateClassMinutes)} continue after
                    18:00.
                  </p>
                ) : null}
                {!candidateAnalysis.schedule.longDays.length &&
                !candidateAnalysis.schedule.earlyClassMinutes &&
                !candidateAnalysis.schedule.lateClassMinutes ? (
                  <p>Your fixed class schedule has no detected long, early, or late-day pattern.</p>
                ) : null}
              </div>
              <section className="scenario-panel" aria-labelledby="scenario-title">
                <div className="interaction-pressure-heading">
                  <div>
                    <p className="eyebrow">WHAT-IF SCENARIO</p>
                    <h3 id="scenario-title">Explore a change without saving it</h3>
                  </div>
                  <span className="course-meta">Current candidate stays unchanged</span>
                </div>
                <div className="scenario-preference-control">
                  <label>
                    Try a different workload priority
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
                    Use “Try this section”, “Try without course”, or “Try without commitment” to
                    compare a possible change here.
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
                              Try without
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
                    <div className="commitment-meetings-heading">
                      <div>
                        <strong>Recurring times</strong>
                        <span>Optional fixed blocks for the timetable.</span>
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
                    <button
                      disabled={busyAction === 'commitment' || !commitmentDraft.name.trim()}
                      type="submit"
                    >
                      {commitmentDraft.id ? 'Save commitment' : 'Add commitment'}
                    </button>
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
                    Choose what matters most. These preferences will guide later semester
                    comparisons without forcing you through a long setup.
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
                                    onSubmit={(event) =>
                                      saveWorkloadProfile(selection.courseOfferingId, event)
                                    }
                                  >
                                    <p className="workload-editor-help">
                                      Unknown dimensions stay blank. Values are estimates, not
                                      grades or official course facts.
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
                                            step="0.5"
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
                                      <span>Saved per semester and course offering.</span>
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
                                Try without course
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
                                  Try without saving
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
        <p className="form-error">{error}</p>
      )}
    </main>
  );
}
