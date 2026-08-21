export const WORKLOAD_ENGINE_VERSION = '0.1' as const;

export const ASSESSMENT_TYPES = [
  'ASSIGNMENT',
  'QUIZ',
  'PROJECT',
  'PRESENTATION',
  'MIDTERM',
  'FINAL',
  'PARTICIPATION',
  'OTHER',
] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export type AssessmentDatePrecision = 'EXACT' | 'APPROXIMATE' | 'WEEK_ONLY' | 'UNKNOWN';
export type AssessmentCompletionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
export type CanonicalAssessmentStatus =
  'UPCOMING' | 'SUBMITTED' | 'GRADED' | 'MISSING' | 'EXCUSED' | 'DROPPED' | 'CANCELLED';
export type CommitmentFlexibility = 'HARD' | 'SOFT' | 'FLEXIBLE';
export type PressureBand = 'LIGHT' | 'MANAGEABLE' | 'MODERATE' | 'HIGH' | 'SEVERE';
export type PressureFindingType =
  | 'UPCOMING_PRESSURE_SPIKE'
  | 'ASSESSMENT_CLUSTER'
  | 'MAJOR_DEADLINE_OVERLAP'
  | 'DEADLINE_COMPRESSION'
  | 'COMMITMENT_COLLISION'
  | 'EARLY_START_OPPORTUNITY'
  | 'UNKNOWN_DATES_REDUCE_CONFIDENCE';
export type PressureFindingSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type WorkloadAssessment = {
  id: string;
  courseId: string;
  title: string;
  type: AssessmentType;
  dueAt?: string | Date | null;
  datePrecision?: AssessmentDatePrecision;
  weightPercentage?: number | null;
  estimatedEffortHours?: number | null;
  effortConfidence?: number | null;
  completionStatus?: AssessmentCompletionStatus;
  status?: CanonicalAssessmentStatus;
  progressPercentage?: number | null;
  startAt?: string | Date | null;
  recommendedStartAt?: string | Date | null;
  preparationDays?: number | null;
  difficultyEstimate?: number | null;
  isGroupAssessment?: boolean;
  canStartEarly?: boolean;
};

export type WorkloadCommitment = {
  id: string;
  name: string;
  category?: string;
  startAt: string | Date;
  endAt: string | Date;
  estimatedEffortHours?: number | null;
  flexibility?: CommitmentFlexibility;
  priority?: number | null;
};

export type EffortDefaultConfig = Record<AssessmentType, number | null>;
export type PreparationHorizonConfig = Record<AssessmentType, number>;

export type PressureBandConfig = {
  manageable: number;
  moderate: number;
  high: number;
  severe: number;
};

export type WorkloadEngineConfig = {
  effortDefaults: EffortDefaultConfig;
  preparationDays: PreparationHorizonConfig;
  defaultEffortConfidence: number;
  explicitEffortConfidence: number;
  effortReferenceHours: number;
  dailyCapacityHours: number;
  taskPressureWeights: {
    effort: number;
    urgency: number;
    importance: number;
  };
  overlapCoefficient: number;
  contextSwitchCoefficient: number;
  commitmentFlexibility: Record<CommitmentFlexibility, number>;
  commitmentCoefficient: number;
  compressionCoefficient: number;
  normalizationScale: number;
  majorAssessmentWeight: number;
  majorAssessmentEffortHours: number;
  clusterWindowDays: number;
  minimumClusterAssessments: number;
  deadlineOverlapDays: number;
  peakThreshold: number;
  earlyStartMinimumDays: number;
  pressureBands: PressureBandConfig;
};

export const DEFAULT_EFFORT_DEFAULTS: EffortDefaultConfig = {
  ASSIGNMENT: 6,
  QUIZ: 2.5,
  PROJECT: 15,
  PRESENTATION: 5,
  MIDTERM: 8,
  FINAL: 12,
  PARTICIPATION: 1,
  OTHER: null,
};

export const DEFAULT_PREPARATION_DAYS: PreparationHorizonConfig = {
  ASSIGNMENT: 6,
  QUIZ: 3,
  PROJECT: 21,
  PRESENTATION: 7,
  MIDTERM: 10,
  FINAL: 14,
  PARTICIPATION: 2,
  OTHER: 5,
};

export const DEFAULT_WORKLOAD_ENGINE_CONFIG: WorkloadEngineConfig = {
  effortDefaults: DEFAULT_EFFORT_DEFAULTS,
  preparationDays: DEFAULT_PREPARATION_DAYS,
  defaultEffortConfidence: 0.4,
  explicitEffortConfidence: 0.8,
  effortReferenceHours: 10,
  dailyCapacityHours: 6,
  taskPressureWeights: { effort: 0.45, urgency: 0.35, importance: 0.2 },
  overlapCoefficient: 0.9,
  contextSwitchCoefficient: 0.35,
  commitmentFlexibility: { HARD: 1, SOFT: 0.7, FLEXIBLE: 0.4 },
  commitmentCoefficient: 0.8,
  compressionCoefficient: 0.8,
  normalizationScale: 4,
  majorAssessmentWeight: 10,
  majorAssessmentEffortHours: 6,
  clusterWindowDays: 7,
  minimumClusterAssessments: 2,
  deadlineOverlapDays: 2,
  peakThreshold: 6.5,
  earlyStartMinimumDays: 3,
  pressureBands: { manageable: 2.5, moderate: 4.5, high: 6.5, severe: 8.5 },
};

export type WorkloadAnalysisInput = {
  currentAt: string | Date;
  semesterStartAt?: string | Date | null;
  semesterEndAt?: string | Date | null;
  assessments: readonly WorkloadAssessment[];
  commitments?: readonly WorkloadCommitment[];
  config?: Partial<WorkloadEngineConfig>;
};

export type ResolvedAssessment = {
  id: string;
  courseId: string;
  title: string;
  type: AssessmentType;
  dueAt: string | null;
  preparationStart: string | null;
  preparationDays: number;
  remainingEffortHours: number | null;
  effortSource: 'EXPLICIT' | 'GENERIC_DEFAULT' | 'UNKNOWN';
  effortConfidence: number;
  importance: number | null;
  taskPressure: number | null;
  isMajor: boolean;
  status: AssessmentCompletionStatus | CanonicalAssessmentStatus;
};

export type PressureDriver = {
  id: string;
  kind: 'ASSESSMENT' | 'COMMITMENT';
  label: string;
  courseId?: string;
  estimatedDemandHours: number | null;
  contribution: number;
};

export type DailyPressure = {
  date: string;
  pressure: number;
  band: PressureBand;
  estimatedDemandHours: number | null;
  drivers: string[];
  contributions: PressureDriver[];
};

export type WeeklyPressure = {
  weekStart: string;
  weekEnd: string;
  pressure: number;
  band: PressureBand;
  estimatedDemandHours: number | null;
  majorAssessmentCount: number;
  uniqueCourseCount: number;
  drivers: string[];
};

export type PressureFinding = {
  type: PressureFindingType;
  severity: PressureFindingSeverity;
  messageKey: string;
  windowStart: string | null;
  windowEnd: string | null;
  pressure: number | null;
  assessmentIds: string[];
  commitmentIds: string[];
};

export type PressurePeak = {
  weekStart: string;
  weekEnd: string;
  pressure: number;
  band: PressureBand;
  drivers: string[];
};

export type PressureAnalysis = {
  engineVersion: typeof WORKLOAD_ENGINE_VERSION;
  currentDayPressure: DailyPressure | null;
  currentWeekPressure: WeeklyPressure | null;
  dailyPressure: DailyPressure[];
  weeklyPressure: WeeklyPressure[];
  peakPeriods: PressurePeak[];
  findings: PressureFinding[];
  upcomingAssessments: ResolvedAssessment[];
  confidence: number;
  completeness: number;
};

type ResolvedConfig = WorkloadEngineConfig;
type DayWork = {
  demandHours: number;
  rawPressure: number;
  drivers: Map<string, PressureDriver>;
  activeAssessmentIds: Set<string>;
  activeCourseIds: Set<string>;
  majorAssessmentIds: Set<string>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string | Date, field: string) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} must be a valid date.`);
  return parsed;
}

function dayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

function daysBetween(start: Date, end: Date) {
  return Math.round((dayStart(end).getTime() - dayStart(start).getTime()) / MS_PER_DAY);
}

function minDate(...dates: Date[]) {
  if (!dates.length) throw new Error('At least one date is required.');
  return dates.reduce((earliest, date) => (date.getTime() < earliest.getTime() ? date : earliest));
}

function maxDate(...dates: Date[]) {
  if (!dates.length) throw new Error('At least one date is required.');
  return dates.reduce((latest, date) => (date.getTime() > latest.getTime() ? date : latest));
}

function mergeConfig(overrides?: Partial<WorkloadEngineConfig>): ResolvedConfig {
  const source = overrides ?? {};
  return {
    ...DEFAULT_WORKLOAD_ENGINE_CONFIG,
    ...source,
    effortDefaults: { ...DEFAULT_EFFORT_DEFAULTS, ...source.effortDefaults },
    preparationDays: { ...DEFAULT_PREPARATION_DAYS, ...source.preparationDays },
    taskPressureWeights: {
      ...DEFAULT_WORKLOAD_ENGINE_CONFIG.taskPressureWeights,
      ...source.taskPressureWeights,
    },
    commitmentFlexibility: {
      ...DEFAULT_WORKLOAD_ENGINE_CONFIG.commitmentFlexibility,
      ...source.commitmentFlexibility,
    },
    pressureBands: { ...DEFAULT_WORKLOAD_ENGINE_CONFIG.pressureBands, ...source.pressureBands },
  };
}

function validateConfig(config: ResolvedConfig) {
  const values = [
    config.defaultEffortConfidence,
    config.explicitEffortConfidence,
    config.effortReferenceHours,
    config.dailyCapacityHours,
    config.overlapCoefficient,
    config.contextSwitchCoefficient,
    config.commitmentCoefficient,
    config.compressionCoefficient,
    config.normalizationScale,
    config.majorAssessmentWeight,
    config.majorAssessmentEffortHours,
    config.clusterWindowDays,
    config.minimumClusterAssessments,
    config.deadlineOverlapDays,
    config.peakThreshold,
    config.earlyStartMinimumDays,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Workload engine configuration contains invalid values.');
  }
  const totalWeight = Object.values(config.taskPressureWeights).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (totalWeight <= 0 || Object.values(config.taskPressureWeights).some((value) => value < 0)) {
    throw new Error('Workload task-pressure weights must contain a positive total.');
  }
  for (const type of ASSESSMENT_TYPES) {
    const horizon = config.preparationDays[type];
    if (!Number.isInteger(horizon) || horizon <= 0) {
      throw new Error('Preparation horizons must be positive whole days.');
    }
    const effort = config.effortDefaults[type];
    if (effort !== null && (!Number.isFinite(effort) || effort < 0)) {
      throw new Error('Effort defaults must be finite non-negative numbers or null.');
    }
  }
}

function validateAssessment(assessment: WorkloadAssessment) {
  if (!assessment.id || !assessment.courseId || !assessment.title) {
    throw new Error('Assessments require an id, course id, and title.');
  }
  if (!ASSESSMENT_TYPES.includes(assessment.type))
    throw new Error(`Unsupported assessment type: ${assessment.type}`);
  const numericValues = [
    assessment.weightPercentage,
    assessment.estimatedEffortHours,
    assessment.effortConfidence,
    assessment.progressPercentage,
    assessment.preparationDays,
    assessment.difficultyEstimate,
  ];
  if (
    numericValues.some((value) => value !== null && value !== undefined && !Number.isFinite(value))
  ) {
    throw new Error(`Assessment ${assessment.id} contains a non-finite numeric value.`);
  }
  if (
    assessment.weightPercentage !== null &&
    assessment.weightPercentage !== undefined &&
    (assessment.weightPercentage < 0 || assessment.weightPercentage > 100)
  ) {
    throw new Error(`Assessment ${assessment.id} weight must be between 0 and 100.`);
  }
  if (
    assessment.estimatedEffortHours !== null &&
    assessment.estimatedEffortHours !== undefined &&
    assessment.estimatedEffortHours < 0
  ) {
    throw new Error(`Assessment ${assessment.id} effort must be non-negative.`);
  }
  if (
    assessment.effortConfidence !== null &&
    assessment.effortConfidence !== undefined &&
    (assessment.effortConfidence < 0 || assessment.effortConfidence > 1)
  ) {
    throw new Error(`Assessment ${assessment.id} effort confidence must be between 0 and 1.`);
  }
  if (
    assessment.progressPercentage !== null &&
    assessment.progressPercentage !== undefined &&
    (assessment.progressPercentage < 0 || assessment.progressPercentage > 100)
  ) {
    throw new Error(`Assessment ${assessment.id} progress must be between 0 and 100.`);
  }
  if (
    assessment.preparationDays !== null &&
    assessment.preparationDays !== undefined &&
    (!Number.isInteger(assessment.preparationDays) || assessment.preparationDays <= 0)
  ) {
    throw new Error(
      `Assessment ${assessment.id} preparation days must be a positive whole number.`,
    );
  }
  if (assessment.dueAt !== null && assessment.dueAt !== undefined)
    parseDate(assessment.dueAt, 'Assessment dueAt');
  if (assessment.startAt !== null && assessment.startAt !== undefined)
    parseDate(assessment.startAt, 'Assessment startAt');
  if (assessment.recommendedStartAt !== null && assessment.recommendedStartAt !== undefined) {
    parseDate(assessment.recommendedStartAt, 'Assessment recommendedStartAt');
  }
}

function isInactive(assessment: WorkloadAssessment) {
  return (
    assessment.completionStatus === 'DONE' ||
    assessment.completionStatus === 'SKIPPED' ||
    assessment.status === 'SUBMITTED' ||
    assessment.status === 'GRADED' ||
    assessment.status === 'EXCUSED' ||
    assessment.status === 'DROPPED' ||
    assessment.status === 'CANCELLED'
  );
}

function resolveAssessment(
  assessment: WorkloadAssessment,
  config: ResolvedConfig,
  current: Date,
): ResolvedAssessment {
  const due =
    assessment.dueAt == null || assessment.datePrecision === 'UNKNOWN'
      ? null
      : dayStart(parseDate(assessment.dueAt, 'Assessment dueAt'));
  const preparationDays = assessment.preparationDays ?? config.preparationDays[assessment.type];
  const explicitEffort = assessment.estimatedEffortHours;
  const defaultEffort = config.effortDefaults[assessment.type];
  const effortSource =
    explicitEffort != null ? 'EXPLICIT' : defaultEffort != null ? 'GENERIC_DEFAULT' : 'UNKNOWN';
  const totalEffort = explicitEffort ?? defaultEffort;
  const progress = clamp((assessment.progressPercentage ?? 0) / 100);
  const remainingEffortHours =
    isInactive(assessment) || totalEffort === null ? null : totalEffort * (1 - progress);
  const effortConfidence = clamp(
    assessment.effortConfidence ??
      (effortSource === 'EXPLICIT'
        ? config.explicitEffortConfidence
        : config.defaultEffortConfidence),
  );
  const weight = assessment.weightPercentage ?? null;
  const importance = weight === null ? null : 10 * Math.sqrt(weight / 100);
  const isMajor =
    (weight !== null && weight >= config.majorAssessmentWeight) ||
    (remainingEffortHours !== null && remainingEffortHours >= config.majorAssessmentEffortHours);
  const preparationStart = due ? addDays(due, -(preparationDays - 1)) : null;
  const effortScore =
    remainingEffortHours === null
      ? null
      : 10 * (1 - Math.exp(-remainingEffortHours / config.effortReferenceHours));
  const urgency =
    due === null ? null : 10 / (1 + Math.max(0, daysBetween(current, due)) / preparationDays);
  const taskPressure =
    effortScore === null || urgency === null || importance === null
      ? effortScore === null || urgency === null
        ? null
        : config.taskPressureWeights.effort * effortScore +
          config.taskPressureWeights.urgency * urgency
      : ((config.taskPressureWeights.effort * effortScore +
          config.taskPressureWeights.urgency * urgency +
          config.taskPressureWeights.importance * importance) /
          (config.taskPressureWeights.effort +
            config.taskPressureWeights.urgency +
            config.taskPressureWeights.importance)) *
        1;

  return {
    id: assessment.id,
    courseId: assessment.courseId,
    title: assessment.title,
    type: assessment.type,
    dueAt: due ? dateOnly(due) : null,
    preparationStart: preparationStart ? dateOnly(preparationStart) : null,
    preparationDays,
    remainingEffortHours: remainingEffortHours === null ? null : round(remainingEffortHours),
    effortSource,
    effortConfidence,
    importance: importance === null ? null : round(importance),
    taskPressure: taskPressure === null ? null : round(taskPressure),
    isMajor,
    status: assessment.completionStatus ?? assessment.status ?? 'NOT_STARTED',
  };
}

function pressureBand(pressure: number, bands: PressureBandConfig): PressureBand {
  if (pressure >= bands.severe) return 'SEVERE';
  if (pressure >= bands.high) return 'HIGH';
  if (pressure >= bands.moderate) return 'MODERATE';
  if (pressure >= bands.manageable) return 'MANAGEABLE';
  return 'LIGHT';
}

function normalize(raw: number, scale: number) {
  return round(10 * (1 - Math.exp(-Math.max(0, raw) / scale)));
}

function monday(value: Date) {
  const date = dayStart(value);
  const day = date.getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function dateRange(start: Date, end: Date) {
  const result: Date[] = [];
  for (let date = dayStart(start); date.getTime() <= end.getTime(); date = addDays(date, 1))
    result.push(date);
  return result;
}

function validateCommitment(commitment: WorkloadCommitment) {
  if (!commitment.id || !commitment.name) throw new Error('Commitments require an id and name.');
  const start = parseDate(commitment.startAt, 'Commitment startAt');
  const end = parseDate(commitment.endAt, 'Commitment endAt');
  if (start.getTime() >= end.getTime())
    throw new Error(`Commitment ${commitment.id} must end after it starts.`);
  if (
    commitment.estimatedEffortHours !== null &&
    commitment.estimatedEffortHours !== undefined &&
    (!Number.isFinite(commitment.estimatedEffortHours) || commitment.estimatedEffortHours < 0)
  ) {
    throw new Error(`Commitment ${commitment.id} effort must be non-negative.`);
  }
  if (
    commitment.priority !== null &&
    commitment.priority !== undefined &&
    (commitment.priority < 0 || commitment.priority > 1)
  ) {
    throw new Error(`Commitment ${commitment.id} priority must be between 0 and 1.`);
  }
}

function newDayWork(): DayWork {
  return {
    demandHours: 0,
    rawPressure: 0,
    drivers: new Map(),
    activeAssessmentIds: new Set(),
    activeCourseIds: new Set(),
    majorAssessmentIds: new Set(),
  };
}

function addDriver(work: DayWork, driver: PressureDriver) {
  const existing = work.drivers.get(driver.id);
  if (existing) {
    existing.contribution = round(existing.contribution + driver.contribution);
    existing.estimatedDemandHours =
      existing.estimatedDemandHours === null || driver.estimatedDemandHours === null
        ? null
        : round(existing.estimatedDemandHours + driver.estimatedDemandHours);
  } else {
    work.drivers.set(driver.id, { ...driver, contribution: round(driver.contribution) });
  }
}

function buildRange(
  input: WorkloadAnalysisInput,
  current: Date,
  resolved: readonly ResolvedAssessment[],
  commitments: readonly WorkloadCommitment[],
) {
  const knownDates = [
    ...resolved.flatMap((assessment) =>
      assessment.dueAt ? [parseDate(assessment.dueAt, 'Assessment dueAt')] : [],
    ),
    ...commitments.flatMap((commitment) => [
      dayStart(parseDate(commitment.startAt, 'Commitment startAt')),
    ]),
  ];
  const explicitStart =
    input.semesterStartAt == null
      ? null
      : dayStart(parseDate(input.semesterStartAt, 'semesterStartAt'));
  const explicitEnd =
    input.semesterEndAt == null ? null : dayStart(parseDate(input.semesterEndAt, 'semesterEndAt'));
  const earliestPreparation = resolved.flatMap((assessment) =>
    assessment.preparationStart
      ? [parseDate(assessment.preparationStart, 'Assessment preparationStart')]
      : [],
  );
  const fallbackStart =
    knownDates.length || earliestPreparation.length
      ? minDate(...[...knownDates, ...earliestPreparation])
      : dayStart(current);
  const fallbackEnd = knownDates.length ? maxDate(...knownDates) : dayStart(current);
  const start = explicitStart ?? minDate(dayStart(current), fallbackStart);
  const end = explicitEnd ?? maxDate(dayStart(current), fallbackEnd);
  if (end.getTime() < start.getTime())
    throw new Error('Semester end must not be before semester start.');
  return { start, end };
}

function severityForPressure(pressure: number): PressureFindingSeverity {
  if (pressure >= 8.5) return 'CRITICAL';
  if (pressure >= 6.5) return 'HIGH';
  if (pressure >= 4.5) return 'MEDIUM';
  return 'LOW';
}

function sortedUnique(values: Iterable<string>) {
  return [...new Set(values)].sort();
}

export function calculateImportance(weightPercentage: number | null | undefined) {
  if (weightPercentage == null) return null;
  if (!Number.isFinite(weightPercentage) || weightPercentage < 0 || weightPercentage > 100) {
    throw new Error('Assessment weight must be between 0 and 100.');
  }
  return round(10 * Math.sqrt(weightPercentage / 100));
}

export function calculatePressureBand(
  pressure: number,
  config: PressureBandConfig = DEFAULT_WORKLOAD_ENGINE_CONFIG.pressureBands,
) {
  if (!Number.isFinite(pressure) || pressure < 0)
    throw new Error('Pressure must be a finite non-negative number.');
  return pressureBand(pressure, config);
}

export function analyzeWorkload(input: WorkloadAnalysisInput): PressureAnalysis {
  const config = mergeConfig(input.config);
  validateConfig(config);
  const current = dayStart(parseDate(input.currentAt, 'currentAt'));
  const commitments = [...(input.commitments ?? [])];
  for (const assessment of input.assessments) validateAssessment(assessment);
  for (const commitment of commitments) validateCommitment(commitment);

  const resolved = input.assessments.map((assessment) =>
    resolveAssessment(assessment, config, current),
  );
  const { start, end } = buildRange(input, current, resolved, commitments);
  const dates = dateRange(start, end);
  const workByDate = new Map<string, DayWork>();
  for (const date of dates) workByDate.set(dateOnly(date), newDayWork());

  for (const [index, assessment] of input.assessments.entries()) {
    const item = resolved[index];
    if (
      !item ||
      item.dueAt === null ||
      item.remainingEffortHours === null ||
      isInactive(assessment)
    )
      continue;
    const due = parseDate(item.dueAt, 'Assessment dueAt');
    const prepStart = parseDate(item.preparationStart ?? item.dueAt, 'Assessment preparationStart');
    const distributionStart = assessment.recommendedStartAt
      ? maxDate(
          dayStart(parseDate(assessment.recommendedStartAt, 'Assessment recommendedStartAt')),
          prepStart,
        )
      : prepStart;
    const effectiveStart = maxDate(
      distributionStart,
      start,
      due.getTime() < current.getTime() ? current : distributionStart,
    );
    const effectiveEnd = minDate(due.getTime() < current.getTime() ? current : due, end);
    const distributionDays = Math.max(1, daysBetween(effectiveStart, effectiveEnd) + 1);
    const dailyEffort = item.remainingEffortHours / distributionDays;
    const importance = item.importance ?? 0;
    const totalWeight =
      config.taskPressureWeights.effort +
      config.taskPressureWeights.urgency +
      config.taskPressureWeights.importance;
    const effortScore =
      10 * (1 - Math.exp(-item.remainingEffortHours / config.effortReferenceHours));
    for (const date of dateRange(effectiveStart, effectiveEnd)) {
      const key = dateOnly(date);
      const work = workByDate.get(key);
      if (!work) continue;
      const daysRemaining = Math.max(0, daysBetween(date, due));
      const urgency = 10 / (1 + daysRemaining / item.preparationDays);
      const taskPressure =
        (config.taskPressureWeights.effort * effortScore +
          config.taskPressureWeights.urgency * urgency +
          config.taskPressureWeights.importance * importance) /
        totalWeight;
      const compression = Math.min(
        2,
        item.remainingEffortHours / config.dailyCapacityHours / distributionDays,
      );
      const contribution =
        (dailyEffort / config.dailyCapacityHours) * taskPressure +
        compression * config.compressionCoefficient;
      work.demandHours += dailyEffort;
      work.rawPressure += contribution;
      work.activeAssessmentIds.add(item.id);
      work.activeCourseIds.add(item.courseId);
      if (item.isMajor) work.majorAssessmentIds.add(item.id);
      addDriver(work, {
        id: item.id,
        kind: 'ASSESSMENT',
        label: item.title,
        courseId: item.courseId,
        estimatedDemandHours: dailyEffort,
        contribution,
      });
    }
  }

  for (const commitment of commitments) {
    const startAt = dayStart(parseDate(commitment.startAt, 'Commitment startAt'));
    const endAt = dayStart(parseDate(commitment.endAt, 'Commitment endAt'));
    const effectiveStart = maxDate(startAt, start);
    const effectiveEnd = minDate(endAt, end);
    if (effectiveEnd.getTime() < effectiveStart.getTime()) continue;
    const days = Math.max(1, daysBetween(effectiveStart, effectiveEnd) + 1);
    const durationHours = Math.max(
      0,
      (parseDate(commitment.endAt, 'Commitment endAt').getTime() -
        parseDate(commitment.startAt, 'Commitment startAt').getTime()) /
        (60 * 60 * 1000),
    );
    const effort = commitment.estimatedEffortHours ?? durationHours;
    const flexibility = commitment.flexibility ?? 'FLEXIBLE';
    const priority = commitment.priority ?? 0.5;
    const dailyEffort = effort / days;
    for (const date of dateRange(effectiveStart, effectiveEnd)) {
      const work = workByDate.get(dateOnly(date));
      if (!work) continue;
      const contribution =
        (dailyEffort / config.dailyCapacityHours) *
        config.commitmentCoefficient *
        config.commitmentFlexibility[flexibility] *
        (0.5 + priority / 2) *
        10;
      work.demandHours += dailyEffort;
      work.rawPressure += contribution;
      addDriver(work, {
        id: commitment.id,
        kind: 'COMMITMENT',
        label: commitment.name,
        estimatedDemandHours: dailyEffort,
        contribution,
      });
    }
  }

  for (const work of workByDate.values()) {
    const overlapCount = work.activeAssessmentIds.size;
    if (overlapCount > 1)
      work.rawPressure += config.overlapCoefficient * (overlapCount - 1) ** 1.25;
    const courseCount = work.activeCourseIds.size;
    if (courseCount > 2) work.rawPressure += config.contextSwitchCoefficient * (courseCount - 2);
  }

  const dailyPressure = dates.map((date) => {
    const key = dateOnly(date);
    const work = workByDate.get(key) ?? newDayWork();
    const contributions = [...work.drivers.values()].sort(
      (first, second) =>
        second.contribution - first.contribution || first.id.localeCompare(second.id),
    );
    return {
      date: key,
      pressure: normalize(work.rawPressure, config.normalizationScale),
      band: pressureBand(
        normalize(work.rawPressure, config.normalizationScale),
        config.pressureBands,
      ),
      estimatedDemandHours:
        work.drivers.size &&
        [...work.drivers.values()].every((driver) => driver.estimatedDemandHours !== null)
          ? round(work.demandHours)
          : null,
      drivers: contributions.map((driver) => driver.id),
      contributions,
    } satisfies DailyPressure;
  });

  const weeklyWork = new Map<string, { dates: DailyPressure[] }>();
  for (const day of dailyPressure) {
    const weekStart = dateOnly(monday(parseDate(day.date, 'daily pressure date')));
    const week = weeklyWork.get(weekStart) ?? { dates: [] };
    week.dates.push(day);
    weeklyWork.set(weekStart, week);
  }
  const weeklyPressure = [...weeklyWork.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([weekStart, week]) => {
      const weekEnd = dateOnly(addDays(parseDate(weekStart, 'weekStart'), 6));
      const daysWithDemand = week.dates.filter((day) => day.estimatedDemandHours !== null);
      const rawAverage =
        week.dates.reduce((sum, day) => sum + day.pressure, 0) / Math.max(1, week.dates.length);
      const rawPeak = Math.max(...week.dates.map((day) => day.pressure), 0);
      const pressure = round(clamp(rawAverage * 0.6 + rawPeak * 0.4, 0, 10));
      const weekAssessmentIds = new Set<string>();
      const weekCourseIds = new Set<string>();
      const majorAssessmentIds = new Set<string>();
      for (const day of week.dates) {
        const work = workByDate.get(day.date);
        if (!work) continue;
        work.activeAssessmentIds.forEach((id) => weekAssessmentIds.add(id));
        work.activeCourseIds.forEach((id) => weekCourseIds.add(id));
        work.majorAssessmentIds.forEach((id) => majorAssessmentIds.add(id));
      }
      return {
        weekStart,
        weekEnd,
        pressure,
        band: pressureBand(pressure, config.pressureBands),
        estimatedDemandHours:
          daysWithDemand.length === week.dates.length
            ? round(week.dates.reduce((sum, day) => sum + (day.estimatedDemandHours ?? 0), 0))
            : null,
        majorAssessmentCount: majorAssessmentIds.size,
        uniqueCourseCount: weekCourseIds.size,
        drivers: sortedUnique(week.dates.flatMap((day) => day.drivers)),
      } satisfies WeeklyPressure;
    });

  const currentDayPressure = dailyPressure.find((day) => day.date === dateOnly(current)) ?? null;
  const currentWeekStart = dateOnly(monday(current));
  const currentWeekPressure =
    weeklyPressure.find((week) => week.weekStart === currentWeekStart) ?? null;
  const peakPeriods = weeklyPressure
    .filter(
      (week, index) =>
        week.pressure >= config.peakThreshold &&
        (index === 0 || week.pressure >= (weeklyPressure[index - 1]?.pressure ?? 0)) &&
        (index === weeklyPressure.length - 1 ||
          week.pressure >= (weeklyPressure[index + 1]?.pressure ?? 0)),
    )
    .sort(
      (first, second) =>
        second.pressure - first.pressure || first.weekStart.localeCompare(second.weekStart),
    )
    .map((week) => ({
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      pressure: week.pressure,
      band: week.band,
      drivers: week.drivers,
    }));

  const findings: PressureFinding[] = [];
  const addFinding = (finding: PressureFinding) => findings.push(finding);
  for (const week of weeklyPressure) {
    if (week.pressure >= config.peakThreshold) {
      addFinding({
        type: 'UPCOMING_PRESSURE_SPIKE',
        severity: severityForPressure(week.pressure),
        messageKey: 'upcoming_pressure_spike',
        windowStart: week.weekStart,
        windowEnd: week.weekEnd,
        pressure: week.pressure,
        assessmentIds: week.drivers.filter((id) =>
          resolved.some((assessment) => assessment.id === id),
        ),
        commitmentIds: week.drivers.filter((id) =>
          commitments.some((commitment) => commitment.id === id),
        ),
      });
    }
  }

  const datedAssessments = resolved.filter(
    (assessment) =>
      assessment.dueAt !== null &&
      assessment.remainingEffortHours !== null &&
      !['DROPPED', 'CANCELLED', 'DONE', 'SKIPPED'].includes(assessment.status),
  );
  const clusterWindow = config.clusterWindowDays - 1;
  for (let index = 0; index < datedAssessments.length; index += 1) {
    const first = datedAssessments[index];
    if (!first?.dueAt) continue;
    const firstDue = parseDate(first.dueAt, 'Assessment dueAt');
    const cluster = datedAssessments.filter(
      (assessment) =>
        assessment.dueAt &&
        Math.abs(daysBetween(firstDue, parseDate(assessment.dueAt, 'Assessment dueAt'))) <=
          clusterWindow,
    );
    if (cluster.length >= config.minimumClusterAssessments) {
      const datesInCluster = cluster.flatMap((assessment) =>
        assessment.dueAt ? [parseDate(assessment.dueAt, 'Assessment dueAt')] : [],
      );
      addFinding({
        type: 'ASSESSMENT_CLUSTER',
        severity: cluster.some((assessment) => assessment.isMajor) ? 'HIGH' : 'MEDIUM',
        messageKey: 'assessment_cluster',
        windowStart: dateOnly(minDate(...datesInCluster)),
        windowEnd: dateOnly(maxDate(...datesInCluster)),
        pressure: null,
        assessmentIds: cluster.map((assessment) => assessment.id).sort(),
        commitmentIds: [],
      });
      break;
    }
  }

  for (let firstIndex = 0; firstIndex < datedAssessments.length; firstIndex += 1) {
    const first = datedAssessments[firstIndex];
    if (!first?.dueAt || !first.isMajor) continue;
    for (const second of datedAssessments.slice(firstIndex + 1)) {
      if (!second.dueAt || !second.isMajor) continue;
      const gap = Math.abs(
        daysBetween(
          parseDate(first.dueAt, 'Assessment dueAt'),
          parseDate(second.dueAt, 'Assessment dueAt'),
        ),
      );
      if (gap <= config.deadlineOverlapDays) {
        addFinding({
          type: 'MAJOR_DEADLINE_OVERLAP',
          severity: 'HIGH',
          messageKey: 'major_deadline_overlap',
          windowStart: first.dueAt < second.dueAt ? first.dueAt : second.dueAt,
          windowEnd: first.dueAt > second.dueAt ? first.dueAt : second.dueAt,
          pressure: null,
          assessmentIds: [first.id, second.id].sort(),
          commitmentIds: [],
        });
      }
    }
  }

  for (const assessment of datedAssessments) {
    if (
      !assessment.dueAt ||
      !assessment.preparationStart ||
      assessment.remainingEffortHours === null
    )
      continue;
    const due = parseDate(assessment.dueAt, 'Assessment dueAt');
    const prepStart = parseDate(assessment.preparationStart, 'Assessment preparationStart');
    const daysLeft = daysBetween(current, due);
    if (daysLeft <= Math.max(1, Math.floor(assessment.preparationDays * 0.5))) {
      addFinding({
        type: 'DEADLINE_COMPRESSION',
        severity: daysLeft <= 1 ? 'CRITICAL' : 'HIGH',
        messageKey: 'deadline_compression',
        windowStart: dateOnly(maxDate(current, prepStart)),
        windowEnd: assessment.dueAt,
        pressure: assessment.taskPressure,
        assessmentIds: [assessment.id],
        commitmentIds: [],
      });
    } else if (
      (input.assessments.find((candidate) => candidate.id === assessment.id)?.canStartEarly ??
        true) &&
      daysLeft >= config.earlyStartMinimumDays
    ) {
      const assessmentWeek = weeklyPressure.find(
        (week) => week.weekStart === dateOnly(monday(due)),
      );
      if (assessmentWeek && assessmentWeek.pressure >= config.peakThreshold) {
        addFinding({
          type: 'EARLY_START_OPPORTUNITY',
          severity: 'MEDIUM',
          messageKey: 'early_start_opportunity',
          windowStart: assessment.preparationStart,
          windowEnd: assessment.dueAt,
          pressure: assessmentWeek.pressure,
          assessmentIds: [assessment.id],
          commitmentIds: [],
        });
      }
    }
  }

  for (const commitment of commitments) {
    const commitmentStart = dayStart(parseDate(commitment.startAt, 'Commitment startAt'));
    const commitmentEnd = dayStart(parseDate(commitment.endAt, 'Commitment endAt'));
    const colliding = datedAssessments.filter((assessment) => {
      if (!assessment.preparationStart || !assessment.dueAt) return false;
      const prepStart = parseDate(assessment.preparationStart, 'Assessment preparationStart');
      const due = parseDate(assessment.dueAt, 'Assessment dueAt');
      return (
        prepStart.getTime() <= commitmentEnd.getTime() && due.getTime() >= commitmentStart.getTime()
      );
    });
    if (colliding.length) {
      addFinding({
        type: 'COMMITMENT_COLLISION',
        severity: commitment.flexibility === 'HARD' ? 'HIGH' : 'MEDIUM',
        messageKey: 'commitment_collision',
        windowStart: dateOnly(commitmentStart),
        windowEnd: dateOnly(commitmentEnd),
        pressure: null,
        assessmentIds: colliding.map((assessment) => assessment.id).sort(),
        commitmentIds: [commitment.id],
      });
    }
  }

  const unknownDateCount = input.assessments.filter(
    (assessment) => assessment.dueAt == null || assessment.datePrecision === 'UNKNOWN',
  ).length;
  if (unknownDateCount > 0) {
    addFinding({
      type: 'UNKNOWN_DATES_REDUCE_CONFIDENCE',
      severity: 'INFO',
      messageKey: 'unknown_dates_reduce_confidence',
      windowStart: null,
      windowEnd: null,
      pressure: null,
      assessmentIds: input.assessments
        .filter((assessment) => assessment.dueAt == null || assessment.datePrecision === 'UNKNOWN')
        .map((assessment) => assessment.id)
        .sort(),
      commitmentIds: [],
    });
  }

  findings.sort(
    (first, second) =>
      first.type.localeCompare(second.type) ||
      (first.windowStart ?? '').localeCompare(second.windowStart ?? '') ||
      first.assessmentIds.join(',').localeCompare(second.assessmentIds.join(',')),
  );
  const knownDateCount = input.assessments.filter(
    (assessment) => assessment.dueAt != null && assessment.datePrecision !== 'UNKNOWN',
  ).length;
  const confidenceSamples = input.assessments.map((assessment) => {
    const dateConfidence =
      assessment.dueAt != null && assessment.datePrecision !== 'UNKNOWN' ? 1 : 0.35;
    const effortConfidence =
      assessment.effortConfidence ??
      (assessment.estimatedEffortHours != null
        ? config.explicitEffortConfidence
        : config.defaultEffortConfidence);
    return (dateConfidence + clamp(effortConfidence)) / 2;
  });
  const confidence = confidenceSamples.length
    ? round(confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length)
    : 0;
  const completeness = input.assessments.length
    ? round(knownDateCount / input.assessments.length)
    : 1;
  const upcomingAssessments = resolved
    .filter(
      (assessment) =>
        assessment.dueAt !== null &&
        !['DONE', 'SKIPPED', 'DROPPED', 'CANCELLED', 'SUBMITTED', 'GRADED', 'EXCUSED'].includes(
          assessment.status,
        ),
    )
    .sort(
      (first, second) =>
        (second.taskPressure ?? 0) - (first.taskPressure ?? 0) ||
        (first.dueAt ?? '').localeCompare(second.dueAt ?? '') ||
        first.id.localeCompare(second.id),
    );

  return {
    engineVersion: WORKLOAD_ENGINE_VERSION,
    currentDayPressure,
    currentWeekPressure,
    dailyPressure,
    weeklyPressure,
    peakPeriods,
    findings,
    upcomingAssessments,
    confidence,
    completeness,
  };
}
