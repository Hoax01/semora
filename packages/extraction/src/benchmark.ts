import type { CourseDocumentExtraction } from './provider.js';
import { validateCourseDocumentExtraction } from './validation.js';

export type BenchmarkExpectedWeight = {
  name: string;
  weight: number;
};

export type BenchmarkExpectedAssessment = {
  title: string;
  type: CourseDocumentExtraction['assessments'][number]['type'];
};

export type BenchmarkExpectedDate = {
  title: string;
  dueDate: string;
};

export type BenchmarkExpectedThreshold = {
  label: string;
  minimumPercentage: number;
};

export type BenchmarkExpected = {
  courseCode: string;
  gradingMode: CourseDocumentExtraction['gradingScheme']['gradingMode'];
  weights: BenchmarkExpectedWeight[];
  assessments: BenchmarkExpectedAssessment[];
  dates: BenchmarkExpectedDate[];
  thresholds: BenchmarkExpectedThreshold[];
  dropRules: string[];
};

export type BenchmarkCase = {
  id: string;
  fileName: string;
  expected: BenchmarkExpected;
  notes?: string;
};

export type BenchmarkMetric = {
  expectedCount: number;
  predictedCount: number;
  matchedCount: number;
  correctCount: number;
  accuracy: number | null;
};

export type BenchmarkCaseResult = {
  id: string;
  fileName: string;
  courseCode: {
    expected: string;
    predicted: string | null;
    correct: boolean;
  };
  gradingMode: {
    expected: string;
    predicted: string;
    correct: boolean;
  };
  weights: BenchmarkMetric & { meanAbsoluteError: number | null };
  assessments: BenchmarkMetric & { typeAccuracy: number | null };
  dates: BenchmarkMetric;
  thresholds: BenchmarkMetric;
  dropRules: BenchmarkMetric;
  correctionNeeded: boolean;
  blockingIssues: string[];
  warnings: string[];
  error?: string;
};

export type BenchmarkSummary = {
  caseCount: number;
  successfulCaseCount: number;
  extractionFailureRate: number;
  correctionRate: number | null;
  blockingConflictRate: number | null;
  courseCodeAccuracy: number | null;
  gradingModeAccuracy: number | null;
  weightAccuracy: number | null;
  assessmentRecall: number | null;
  assessmentTypeAccuracy: number | null;
  dateAccuracy: number | null;
  thresholdAccuracy: number | null;
  dropRuleRecall: number | null;
};

function normalizedText(value: string) {
  return value
    .toLowerCase()
    .replace(/^\s*\d+\s*[.)]\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function average(values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

function metricFor(
  expectedCount: number,
  predictedCount: number,
  matchedCount: number,
  correctCount: number,
): BenchmarkMetric {
  return {
    expectedCount,
    predictedCount,
    matchedCount,
    correctCount,
    accuracy: expectedCount ? correctCount / expectedCount : null,
  };
}

type Labelled = { name?: string; title?: string; label?: string };

function matchByLabel<T extends Labelled>(expected: Labelled, predicted: T[], used: Set<number>) {
  const expectedLabel = normalizedText(expected.name ?? expected.title ?? expected.label ?? '');
  const index = predicted.findIndex((candidate, candidateIndex) => {
    if (used.has(candidateIndex)) return false;
    const candidateLabel = normalizedText(
      candidate.name ?? candidate.title ?? candidate.label ?? '',
    );
    return candidateLabel === expectedLabel;
  });
  if (index < 0) return undefined;
  used.add(index);
  return predicted[index];
}

function evaluateWeights(
  expected: BenchmarkExpectedWeight[],
  extraction: CourseDocumentExtraction,
) {
  const predicted = extraction.gradingScheme.categories;
  const used = new Set<number>();
  let matchedCount = 0;
  let correctCount = 0;
  let totalAbsoluteError = 0;
  for (const expectedWeight of expected) {
    const actual = matchByLabel(expectedWeight, predicted, used);
    if (!actual) continue;
    matchedCount += 1;
    const absoluteError = Math.abs((actual.weightPercentage ?? Number.NaN) - expectedWeight.weight);
    if (Number.isFinite(absoluteError)) {
      totalAbsoluteError += absoluteError;
      if (absoluteError <= 0.001) correctCount += 1;
    }
  }
  const metric = metricFor(expected.length, predicted.length, matchedCount, correctCount);
  return {
    ...metric,
    meanAbsoluteError: matchedCount ? totalAbsoluteError / matchedCount : null,
  };
}

function evaluateAssessments(
  expected: BenchmarkExpectedAssessment[],
  extraction: CourseDocumentExtraction,
) {
  const predicted = extraction.assessments;
  const used = new Set<number>();
  let matchedCount = 0;
  let correctCount = 0;
  for (const expectedAssessment of expected) {
    const actual = matchByLabel(expectedAssessment, predicted, used);
    if (!actual) continue;
    matchedCount += 1;
    if (actual.type === expectedAssessment.type) correctCount += 1;
  }
  const metric = metricFor(expected.length, predicted.length, matchedCount, matchedCount);
  return { ...metric, typeAccuracy: matchedCount ? correctCount / matchedCount : null };
}

function evaluateDates(expected: BenchmarkExpectedDate[], extraction: CourseDocumentExtraction) {
  const predicted = extraction.assessments.filter(
    (assessment): assessment is typeof assessment & { dueDate: string } =>
      Boolean(assessment.dueDate),
  );
  const used = new Set<number>();
  let matchedCount = 0;
  let correctCount = 0;
  for (const expectedDate of expected) {
    const actual = matchByLabel(expectedDate, predicted, used);
    if (!actual) continue;
    matchedCount += 1;
    if (actual.dueDate === expectedDate.dueDate) correctCount += 1;
  }
  return metricFor(expected.length, predicted.length, matchedCount, correctCount);
}

function evaluateThresholds(
  expected: BenchmarkExpectedThreshold[],
  extraction: CourseDocumentExtraction,
) {
  const predicted = extraction.gradingScheme.thresholds;
  const used = new Set<number>();
  let matchedCount = 0;
  let correctCount = 0;
  for (const expectedThreshold of expected) {
    const actual = matchByLabel(expectedThreshold, predicted, used);
    if (!actual) continue;
    matchedCount += 1;
    if (actual.minimumPercentage === expectedThreshold.minimumPercentage) correctCount += 1;
  }
  return metricFor(expected.length, predicted.length, matchedCount, correctCount);
}

function evaluateDropRules(expected: string[], extraction: CourseDocumentExtraction) {
  const predicted = extraction.gradingScheme.dropRules;
  const normalizedPredicted = predicted.map(normalizedText);
  const matched = expected.filter((rule) => {
    const tokens = normalizedText(rule).split(' ').filter(Boolean);
    return normalizedPredicted.some((candidate) =>
      tokens.every((token) => candidate.includes(token)),
    );
  });
  return metricFor(expected.length, predicted.length, matched.length, matched.length);
}

export function evaluateBenchmarkCase(
  benchmarkCase: BenchmarkCase,
  extraction: CourseDocumentExtraction,
): BenchmarkCaseResult {
  const validation = validateCourseDocumentExtraction(extraction, {
    expectedCourseCode: benchmarkCase.expected.courseCode,
  });
  const courseCodeCorrect =
    normalizedText(extraction.courseIdentity.courseCode ?? '') ===
    normalizedText(benchmarkCase.expected.courseCode);
  const weights = evaluateWeights(benchmarkCase.expected.weights, extraction);
  const assessments = evaluateAssessments(benchmarkCase.expected.assessments, extraction);
  const dates = evaluateDates(benchmarkCase.expected.dates, extraction);
  const thresholds = evaluateThresholds(benchmarkCase.expected.thresholds, extraction);
  const dropRules = evaluateDropRules(benchmarkCase.expected.dropRules, extraction);
  const gradingModeCorrect =
    extraction.gradingScheme.gradingMode === benchmarkCase.expected.gradingMode;
  const correctionNeeded = Boolean(
    !courseCodeCorrect ||
    !gradingModeCorrect ||
    (weights.accuracy !== null && weights.accuracy !== 1) ||
    (assessments.accuracy !== null && assessments.accuracy !== 1) ||
    (assessments.typeAccuracy !== null && assessments.typeAccuracy !== 1) ||
    (dates.accuracy !== null && dates.accuracy !== 1) ||
    (thresholds.accuracy !== null && thresholds.accuracy !== 1) ||
    (dropRules.accuracy !== null && dropRules.accuracy !== 1),
  );

  return {
    id: benchmarkCase.id,
    fileName: benchmarkCase.fileName,
    courseCode: {
      expected: benchmarkCase.expected.courseCode,
      predicted: extraction.courseIdentity.courseCode,
      correct: courseCodeCorrect,
    },
    gradingMode: {
      expected: benchmarkCase.expected.gradingMode,
      predicted: extraction.gradingScheme.gradingMode,
      correct: gradingModeCorrect,
    },
    weights,
    assessments,
    dates,
    thresholds,
    dropRules,
    correctionNeeded,
    blockingIssues: validation.blockingIssues,
    warnings: extraction.warnings.map((warning) => warning.code),
  };
}

export function summarizeBenchmarkResults(results: BenchmarkCaseResult[]): BenchmarkSummary {
  const successful = results.filter((result) => !result.error);
  return {
    caseCount: results.length,
    successfulCaseCount: successful.length,
    extractionFailureRate: (results.length - successful.length) / Math.max(results.length, 1),
    correctionRate: successful.length
      ? successful.filter((result) => result.correctionNeeded).length / successful.length
      : null,
    blockingConflictRate: successful.length
      ? successful.filter((result) => result.blockingIssues.length > 0).length / successful.length
      : null,
    courseCodeAccuracy: average(successful.map((result) => (result.courseCode.correct ? 1 : 0))),
    gradingModeAccuracy: average(successful.map((result) => (result.gradingMode.correct ? 1 : 0))),
    weightAccuracy: average(successful.map((result) => result.weights.accuracy)),
    assessmentRecall: average(successful.map((result) => result.assessments.accuracy)),
    assessmentTypeAccuracy: average(successful.map((result) => result.assessments.typeAccuracy)),
    dateAccuracy: average(successful.map((result) => result.dates.accuracy)),
    thresholdAccuracy: average(successful.map((result) => result.thresholds.accuracy)),
    dropRuleRecall: average(successful.map((result) => result.dropRules.accuracy)),
  };
}

export function benchmarkErrorResult(
  benchmarkCase: BenchmarkCase,
  error: unknown,
): BenchmarkCaseResult {
  const message = error instanceof Error ? error.message : String(error);
  const emptyMetric = metricFor(0, 0, 0, 0);
  return {
    id: benchmarkCase.id,
    fileName: benchmarkCase.fileName,
    courseCode: {
      expected: benchmarkCase.expected.courseCode,
      predicted: null,
      correct: false,
    },
    gradingMode: {
      expected: benchmarkCase.expected.gradingMode,
      predicted: 'UNKNOWN',
      correct: false,
    },
    weights: { ...emptyMetric, meanAbsoluteError: null },
    assessments: { ...emptyMetric, typeAccuracy: null },
    dates: emptyMetric,
    thresholds: emptyMetric,
    dropRules: emptyMetric,
    correctionNeeded: false,
    blockingIssues: [],
    warnings: [],
    error: message,
  };
}
