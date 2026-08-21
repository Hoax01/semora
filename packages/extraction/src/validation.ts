import { courseDocumentExtractionSchema, type CourseDocumentExtraction } from './provider.js';

export type ExtractionValidationContext = {
  expectedCourseCode?: string;
  expectedCourseTitle?: string;
};

export type ExtractionValidationResult = {
  extraction: CourseDocumentExtraction;
  blockingIssues: string[];
  valid: boolean;
};

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedThresholdLabel(value: string) {
  return value.toUpperCase().replace(/\s+/g, '').trim();
}

function normalizedCourseCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[\s-]+/g, ' ')
    .trim();
}

function evidenceOf(extraction: CourseDocumentExtraction) {
  return extraction.courseIdentity.evidence;
}

export function validateCourseDocumentExtraction(
  input: CourseDocumentExtraction,
  context: ExtractionValidationContext = {},
): ExtractionValidationResult {
  const extraction = courseDocumentExtractionSchema.parse(input);
  const warnings = [...extraction.warnings];
  const conflicts = [...extraction.conflicts];
  const blockingIssues: string[] = [];
  const addWarning = (
    code: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH',
    message: string,
    evidence = extraction.courseIdentity.evidence,
  ) => {
    if (!warnings.some((warning) => warning.code === code)) {
      warnings.push({ code, severity, message, evidence });
    }
  };
  const addConflict = (field: string, message: string, values: string[], issue: string) => {
    if (!conflicts.some((conflict) => conflict.field === field && conflict.message === message)) {
      conflicts.push({ field, message, values, evidence: evidenceOf(extraction) });
    }
    if (!blockingIssues.includes(issue)) blockingIssues.push(issue);
  };

  const categoryNames = new Map<string, CourseDocumentExtraction['gradingScheme']['categories']>();
  for (const category of extraction.gradingScheme.categories) {
    const key = normalized(category.name);
    const existing = categoryNames.get(key) ?? [];
    existing.push(category);
    categoryNames.set(key, existing);
  }
  for (const [key, categories] of categoryNames) {
    if (categories.length > 1) {
      addConflict(
        'gradingScheme.categories',
        'The same grading category appears more than once.',
        categories.map(
          (category) => `${category.name}: ${category.weightPercentage ?? 'unknown'}%`,
        ),
        `DUPLICATE_GRADING_CATEGORY:${key}`,
      );
    }
  }

  const knownWeights = extraction.gradingScheme.categories
    .map((category) => category.weightPercentage)
    .filter((weight): weight is number => weight !== null);
  const totalWeight = knownWeights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight > 100.0001) {
    addConflict(
      'gradingScheme.categories',
      'Known grading category weights exceed 100%.',
      [`${totalWeight}%`],
      'WEIGHT_TOTAL_EXCEEDS_100',
    );
  } else if (knownWeights.length > 0 && totalWeight < 99.9999) {
    addWarning(
      'WEIGHT_TOTAL_INCOMPLETE',
      'MEDIUM',
      `Known grading category weights total ${totalWeight}%; remaining components may be missing.`,
    );
  }

  const assessmentNames = new Set<string>();
  for (const assessment of extraction.assessments) {
    const key = `${normalized(assessment.title)}:${assessment.type}`;
    if (assessmentNames.has(key)) {
      addConflict(
        'assessments',
        'The same assessment appears more than once.',
        [assessment.title, assessment.type],
        `DUPLICATE_ASSESSMENT:${key}`,
      );
    }
    assessmentNames.add(key);
  }

  if (context.expectedCourseCode) {
    const actual = extraction.courseIdentity.courseCode;
    if (!actual) {
      addWarning(
        'COURSE_CODE_NOT_FOUND',
        'MEDIUM',
        'The extracted draft does not contain the expected course code.',
      );
    } else if (normalizedCourseCode(actual) !== normalizedCourseCode(context.expectedCourseCode)) {
      addConflict(
        'courseIdentity.courseCode',
        'The extracted course code does not match the active course offering.',
        [actual, context.expectedCourseCode],
        'COURSE_MISMATCH',
      );
    }
  }

  const thresholdLabels = new Set<string>();
  let previousThreshold: number | undefined;
  for (const threshold of extraction.gradingScheme.thresholds) {
    const label = normalizedThresholdLabel(threshold.label);
    if (thresholdLabels.has(label)) {
      addConflict(
        'gradingScheme.thresholds',
        'The same grade threshold label appears more than once.',
        [threshold.label],
        'INVALID_GRADE_THRESHOLDS',
      );
    }
    thresholdLabels.add(label);
    if (previousThreshold !== undefined && threshold.minimumPercentage > previousThreshold) {
      addConflict(
        'gradingScheme.thresholds',
        'Grade thresholds are not ordered from highest to lowest minimum percentage.',
        [String(previousThreshold), String(threshold.minimumPercentage)],
        'INVALID_GRADE_THRESHOLDS',
      );
    }
    previousThreshold = threshold.minimumPercentage;
  }

  const result = courseDocumentExtractionSchema.parse({
    ...extraction,
    warnings,
    conflicts,
    overallConfidence: conflicts.length
      ? Math.min(extraction.overallConfidence, 0.4)
      : extraction.overallConfidence,
  });
  return { extraction: result, blockingIssues, valid: blockingIssues.length === 0 };
}
