export const GRADE_ENGINE_VERSION = '0.1' as const;

export type GradingMode = 'ABSOLUTE' | 'RELATIVE' | 'PASS_FAIL' | 'UNKNOWN';

export type GradeAssessmentStatus =
  'UPCOMING' | 'SUBMITTED_UNGRADED' | 'GRADED' | 'MISSING' | 'EXCUSED' | 'DROPPED' | 'CANCELLED';

export type GradeAggregationRule =
  'EQUAL_MEAN' | 'POINTS_WEIGHTED_MEAN' | 'EXPLICIT_ASSESSMENT_WEIGHTS';

export type GradeScore = {
  pointsEarned?: number | null;
  pointsPossible?: number | null;
  percentage?: number | null;
};

export type GradeThreshold = {
  letterGrade: string;
  minimumPercentage: number;
  inclusive?: boolean;
};

export type GradeTargetAnalysis = {
  target: string;
  threshold: number;
  requiredRemainingAverage: number | null;
  reachable: boolean;
  secured: boolean;
};

export type GradeAssessment = {
  id: string;
  title: string;
  categoryId?: string | null;
  weightPercentage?: number | null;
  pointsPossible?: number | null;
  status?: GradeAssessmentStatus;
  score?: GradeScore | null;
};

export type GradeCategory = {
  id: string;
  name: string;
  weightPercentage: number;
  aggregationRule?: GradeAggregationRule;
};

export type GradeEngineInput = {
  totalExpectedWeight?: number;
  gradingMode?: GradingMode;
  thresholds?: readonly GradeThreshold[];
  categories?: readonly GradeCategory[];
  assessments: readonly GradeAssessment[];
};

export type GradeAssessmentResult = {
  assessmentId: string;
  title: string;
  percentage: number | null;
  weightedPointsEarned: number;
  gradedWeight: number;
  counted: boolean;
  reason:
    | 'GRADED'
    | 'UNGRADED'
    | 'MISSING_SCORE'
    | 'EXCUSED'
    | 'DROPPED'
    | 'CANCELLED'
    | 'MISSING_WEIGHT'
    | 'INVALID_SCORE';
};

export type GradeCategoryResult = {
  categoryId: string;
  name: string;
  weightPercentage: number;
  aggregationRule: GradeAggregationRule;
  percentage: number | null;
  weightedPointsEarned: number;
  gradedWeight: number;
  remainingWeight: number;
  gradedAssessmentCount: number;
  assessmentCount: number;
};

export type GradeEngineResult = {
  engineVersion: typeof GRADE_ENGINE_VERSION;
  totalExpectedWeight: number;
  weightedPointsEarned: number;
  gradedWeight: number;
  remainingWeight: number;
  currentPerformance: number | null;
  currentGrade: string | null;
  targetAnalyses: GradeTargetAnalysis[];
  categories: GradeCategoryResult[];
  assessments: GradeAssessmentResult[];
  warnings: string[];
};

const NON_COUNTING_STATUSES = new Set<GradeAssessmentStatus>([
  'UPCOMING',
  'SUBMITTED_UNGRADED',
  'EXCUSED',
  'DROPPED',
  'CANCELLED',
]);

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(label + ' must be finite.');
}

function assertPercentage(value: number, label: string) {
  assertFinite(value, label);
  if (value < 0 || value > 100) throw new Error(label + ' must be between 0 and 100.');
}

function assertNonNegative(value: number, label: string) {
  assertFinite(value, label);
  if (value < 0) throw new Error(label + ' must be non-negative.');
}

function assessmentPercentage(assessment: GradeAssessment) {
  const score = assessment.score;
  if (!score) return null;

  const hasPercentage = score.percentage !== null && score.percentage !== undefined;
  const hasPoints = score.pointsEarned !== null && score.pointsEarned !== undefined;
  if (!hasPercentage && !hasPoints) return null;

  if (hasPercentage) {
    assertPercentage(score.percentage as number, 'Assessment ' + assessment.id + ' percentage');
    return score.percentage as number;
  }

  const pointsPossible = score.pointsPossible ?? assessment.pointsPossible;
  if (pointsPossible === null || pointsPossible === undefined) {
    throw new Error('Assessment ' + assessment.id + ' needs points possible for a points score.');
  }
  assertNonNegative(score.pointsEarned as number, 'Assessment ' + assessment.id + ' points earned');
  assertFinite(pointsPossible, 'Assessment ' + assessment.id + ' points possible');
  if (pointsPossible <= 0) {
    throw new Error('Assessment ' + assessment.id + ' points possible must be greater than zero.');
  }
  if ((score.pointsEarned as number) > pointsPossible) {
    throw new Error(
      'Assessment ' + assessment.id + ' points earned cannot exceed points possible.',
    );
  }
  return ((score.pointsEarned as number) / pointsPossible) * 100;
}

function validateThresholds(thresholds: readonly GradeThreshold[]) {
  const letters = new Set<string>();
  for (const threshold of thresholds) {
    if (!threshold.letterGrade.trim()) {
      throw new Error('Grade thresholds require a letter grade.');
    }
    if (letters.has(threshold.letterGrade)) {
      throw new Error('Duplicate grade threshold: ' + threshold.letterGrade + '.');
    }
    letters.add(threshold.letterGrade);
    assertPercentage(threshold.minimumPercentage, 'Grade threshold ' + threshold.letterGrade);
  }
}

function currentGradeFor(currentPerformance: number | null, thresholds: readonly GradeThreshold[]) {
  if (currentPerformance === null || thresholds.length === 0) return null;
  const ordered = [...thresholds].sort(
    (left, right) => right.minimumPercentage - left.minimumPercentage,
  );
  return (
    ordered.find((threshold) =>
      threshold.inclusive === false
        ? currentPerformance > threshold.minimumPercentage
        : currentPerformance >= threshold.minimumPercentage,
    )?.letterGrade ?? null
  );
}
function targetAnalysesFor(
  weightedPointsEarned: number,
  remainingWeight: number,
  thresholds: readonly GradeThreshold[],
): GradeTargetAnalysis[] {
  return [...thresholds]
    .sort((left, right) => right.minimumPercentage - left.minimumPercentage)
    .map((threshold) => {
      const secured =
        threshold.inclusive === false
          ? weightedPointsEarned > threshold.minimumPercentage
          : weightedPointsEarned >= threshold.minimumPercentage;
      if (secured) {
        return {
          target: threshold.letterGrade,
          threshold: threshold.minimumPercentage,
          requiredRemainingAverage: 0,
          reachable: true,
          secured: true,
        };
      }
      if (remainingWeight <= 0) {
        return {
          target: threshold.letterGrade,
          threshold: threshold.minimumPercentage,
          requiredRemainingAverage: null,
          reachable: false,
          secured: false,
        };
      }
      const requiredRemainingAverage =
        ((threshold.minimumPercentage - weightedPointsEarned) / remainingWeight) * 100;
      const reachable =
        threshold.inclusive === false
          ? requiredRemainingAverage < 100
          : requiredRemainingAverage <= 100;
      return {
        target: threshold.letterGrade,
        threshold: threshold.minimumPercentage,
        requiredRemainingAverage: round(requiredRemainingAverage),
        reachable,
        secured: false,
      };
    });
}
function validateInput(input: GradeEngineInput, totalExpectedWeight: number) {
  if (!Number.isFinite(totalExpectedWeight) || totalExpectedWeight <= 0) {
    throw new Error('Total expected weight must be greater than zero.');
  }

  validateThresholds(input.thresholds ?? []);

  const categoryIds = new Set<string>();
  for (const category of input.categories ?? []) {
    if (!category.id || !category.name) throw new Error('Categories require an id and name.');
    if (categoryIds.has(category.id))
      throw new Error('Duplicate category id: ' + category.id + '.');
    categoryIds.add(category.id);
    assertPercentage(category.weightPercentage, 'Category ' + category.id + ' weight');
  }

  const assessmentIds = new Set<string>();
  for (const assessment of input.assessments) {
    if (!assessment.id || !assessment.title) {
      throw new Error('Assessments require an id and title.');
    }
    if (assessmentIds.has(assessment.id)) {
      throw new Error('Duplicate assessment id: ' + assessment.id + '.');
    }
    assessmentIds.add(assessment.id);
    if (assessment.categoryId && !categoryIds.has(assessment.categoryId)) {
      throw new Error('Assessment ' + assessment.id + ' references an unknown category.');
    }
    if (assessment.weightPercentage !== null && assessment.weightPercentage !== undefined) {
      assertPercentage(assessment.weightPercentage, 'Assessment ' + assessment.id + ' weight');
    }
    if (assessment.pointsPossible !== null && assessment.pointsPossible !== undefined) {
      assertFinite(assessment.pointsPossible, 'Assessment ' + assessment.id + ' points possible');
      if (assessment.pointsPossible <= 0) {
        throw new Error(
          'Assessment ' + assessment.id + ' points possible must be greater than zero.',
        );
      }
    }
  }
}

function resultForAssessment(assessment: GradeAssessment, weight: number | null) {
  const status = assessment.status ?? 'UPCOMING';
  const base = {
    assessmentId: assessment.id,
    title: assessment.title,
    percentage: null,
    weightedPointsEarned: 0,
    gradedWeight: 0,
    counted: false,
  } satisfies Omit<GradeAssessmentResult, 'reason'>;

  if (status === 'EXCUSED') return { ...base, reason: 'EXCUSED' as const };
  if (status === 'DROPPED') return { ...base, reason: 'DROPPED' as const };
  if (status === 'CANCELLED') return { ...base, reason: 'CANCELLED' as const };
  if (NON_COUNTING_STATUSES.has(status)) return { ...base, reason: 'UNGRADED' as const };
  if (weight === null) return { ...base, reason: 'MISSING_WEIGHT' as const };

  const percentage = assessmentPercentage(assessment);
  if (percentage === null) return { ...base, reason: 'MISSING_SCORE' as const };

  return {
    ...base,
    percentage: round(percentage),
    weightedPointsEarned: round((percentage / 100) * weight),
    gradedWeight: weight,
    counted: true,
    reason: 'GRADED' as const,
  };
}

function categoryResult(
  category: GradeCategory,
  assessments: readonly GradeAssessment[],
  assessmentResults: Map<string, GradeAssessmentResult>,
): GradeCategoryResult {
  const categoryAssessments = assessments.filter(
    (assessment) => assessment.categoryId === category.id,
  );
  const aggregationRule = category.aggregationRule ?? 'EQUAL_MEAN';
  const graded = categoryAssessments.filter(
    (assessment) => assessmentResults.get(assessment.id)?.reason === 'GRADED',
  );
  const eligible = categoryAssessments.filter(
    (assessment) => !['EXCUSED', 'DROPPED', 'CANCELLED'].includes(assessment.status ?? 'UPCOMING'),
  );
  if (aggregationRule === 'EXPLICIT_ASSESSMENT_WEIGHTS') {
    const gradedWeight = graded.reduce(
      (sum, assessment) => sum + (assessmentResults.get(assessment.id)?.gradedWeight ?? 0),
      0,
    );
    const weightedPointsEarned = graded.reduce(
      (sum, assessment) => sum + (assessmentResults.get(assessment.id)?.weightedPointsEarned ?? 0),
      0,
    );
    return {
      categoryId: category.id,
      name: category.name,
      weightPercentage: category.weightPercentage,
      aggregationRule,
      percentage: gradedWeight > 0 ? round((weightedPointsEarned / gradedWeight) * 100) : null,
      weightedPointsEarned: round(weightedPointsEarned),
      gradedWeight: round(gradedWeight),
      remainingWeight: round(Math.max(0, category.weightPercentage - gradedWeight)),
      gradedAssessmentCount: graded.length,
      assessmentCount: categoryAssessments.length,
    };
  }

  const scoreValues = graded.map(
    (assessment) => assessmentResults.get(assessment.id)?.percentage ?? 0,
  );

  let score: number | null = null;
  if (scoreValues.length > 0) {
    if (aggregationRule === 'POINTS_WEIGHTED_MEAN') {
      const points = graded.reduce((sum, assessment) => {
        const possible = assessment.score?.pointsPossible ?? assessment.pointsPossible;
        return possible === null || possible === undefined ? sum : sum + possible;
      }, 0);
      const earned = graded.reduce(
        (sum, assessment) => sum + (assessment.score?.pointsEarned ?? 0),
        0,
      );
      score =
        points > 0
          ? (earned / points) * 100
          : scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length;
    } else {
      score = scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length;
    }
  }

  let completedFraction = 0;
  if (aggregationRule === 'POINTS_WEIGHTED_MEAN') {
    const totalPoints = eligible.reduce(
      (sum, assessment) => sum + (assessment.pointsPossible ?? 0),
      0,
    );
    const gradedPoints = graded.reduce(
      (sum, assessment) =>
        sum + (assessment.score?.pointsPossible ?? assessment.pointsPossible ?? 0),
      0,
    );
    completedFraction = totalPoints > 0 ? gradedPoints / totalPoints : 0;
  } else if (eligible.length > 0) {
    completedFraction = graded.length / eligible.length;
  }

  const gradedWeight = category.weightPercentage * Math.min(1, completedFraction);
  const weightedPointsEarned = score === null ? 0 : (score / 100) * gradedWeight;

  return {
    categoryId: category.id,
    name: category.name,
    weightPercentage: category.weightPercentage,
    aggregationRule,
    percentage: score === null ? null : round(score),
    weightedPointsEarned: round(weightedPointsEarned),
    gradedWeight: round(gradedWeight),
    remainingWeight: round(category.weightPercentage - gradedWeight),
    gradedAssessmentCount: graded.length,
    assessmentCount: categoryAssessments.length,
  };
}

export function calculateGrade(input: GradeEngineInput): GradeEngineResult {
  const totalExpectedWeight = input.totalExpectedWeight ?? 100;
  validateInput(input, totalExpectedWeight);
  const categories = input.categories ?? [];
  const categoryIds = new Set(categories.map((category) => category.id));
  const directAssessments = input.assessments.filter(
    (assessment) => !assessment.categoryId || !categoryIds.has(assessment.categoryId),
  );

  const assessmentResults = new Map<string, GradeAssessmentResult>();
  for (const assessment of input.assessments) {
    const category = categories.find((candidate) => candidate.id === assessment.categoryId);
    const isExplicit = category?.aggregationRule === 'EXPLICIT_ASSESSMENT_WEIGHTS' || !category;
    assessmentResults.set(
      assessment.id,
      resultForAssessment(assessment, isExplicit ? (assessment.weightPercentage ?? null) : 0),
    );
  }

  const categoryResults = categories.map((category) =>
    categoryResult(category, input.assessments, assessmentResults),
  );
  const directResults = directAssessments.map(
    (assessment) => assessmentResults.get(assessment.id) as GradeAssessmentResult,
  );
  const weightedPointsEarned = round(
    directResults.reduce((sum, result) => sum + result.weightedPointsEarned, 0) +
      categoryResults.reduce((sum, result) => sum + result.weightedPointsEarned, 0),
  );
  const gradedWeight = round(
    directResults.reduce((sum, result) => sum + result.gradedWeight, 0) +
      categoryResults.reduce((sum, result) => sum + result.gradedWeight, 0),
  );
  const warnings: string[] = [];
  if (
    categories.reduce((sum, category) => sum + category.weightPercentage, 0) > totalExpectedWeight
  ) {
    warnings.push('Category weights exceed the total expected course weight.');
  }
  if (
    input.assessments.some((assessment) => assessment.status === 'MISSING' && !assessment.score)
  ) {
    warnings.push('A missing assessment has no explicit score and was not treated as zero.');
  }

  return {
    engineVersion: GRADE_ENGINE_VERSION,
    totalExpectedWeight: round(totalExpectedWeight),
    weightedPointsEarned,
    gradedWeight,
    remainingWeight: round(Math.max(0, totalExpectedWeight - gradedWeight)),
    currentPerformance:
      gradedWeight > 0 ? round((weightedPointsEarned / gradedWeight) * 100) : null,
    currentGrade: currentGradeFor(
      gradedWeight > 0 ? round((weightedPointsEarned / gradedWeight) * 100) : null,
      input.gradingMode === 'ABSOLUTE' ? (input.thresholds ?? []) : [],
    ),
    targetAnalyses: targetAnalysesFor(
      weightedPointsEarned,
      Math.max(0, totalExpectedWeight - gradedWeight),
      input.gradingMode === 'ABSOLUTE' ? (input.thresholds ?? []) : [],
    ),
    categories: categoryResults,
    assessments: directResults,
    warnings,
  };
}
