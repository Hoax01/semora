import { describe, expect, it } from 'vitest';
import {
  auditBenchmarkDataset,
  evaluateBenchmarkCase,
  summarizeBenchmarkResults,
  type BenchmarkCase,
} from './benchmark.js';
import { courseDocumentExtractionSchema } from './provider.js';

function extraction(overrides: Record<string, unknown> = {}) {
  return courseDocumentExtractionSchema.parse({
    documentId: 'benchmark-document',
    documentType: 'COURSE_OUTLINE',
    schemaVersion: '0.1',
    extractorVersion: 'test-extractor',
    modelIdentifier: 'test-model',
    courseIdentity: {
      courseCode: 'CS 370',
      title: 'Operating Systems',
      instructors: [],
      confidence: 0.9,
      evidence: [],
    },
    gradingScheme: {
      gradingMode: 'ABSOLUTE',
      categories: [{ name: 'Final', weightPercentage: 40, confidence: 0.9, evidence: [] }],
      thresholds: [{ label: 'A', minimumPercentage: 90, confidence: 0.9, evidence: [] }],
      dropRules: ['drop lowest quiz'],
    },
    assessments: [
      {
        title: 'Final',
        type: 'FINAL',
        weightPercentage: 40,
        dueDate: '2026-12-10',
        recurrence: null,
        confidence: 0.9,
        evidence: [],
      },
    ],
    warnings: [],
    conflicts: [],
    fieldConfidences: {},
    overallConfidence: 0.9,
    ...overrides,
  });
}

const benchmarkCase: BenchmarkCase = {
  id: 'cs-370',
  fileName: 'outline.pdf',
  expected: {
    courseCode: 'CS 370',
    gradingMode: 'ABSOLUTE',
    weights: [{ name: 'Final', weight: 40 }],
    assessments: [{ title: 'Final', type: 'FINAL' }],
    dates: [{ title: 'Final', dueDate: '2026-12-10' }],
    thresholds: [{ label: 'A', minimumPercentage: 90 }],
    dropRules: ['drop lowest quiz'],
  },
};

describe('extraction benchmark metrics', () => {
  it('matches manually labelled weights, assessments, dates, thresholds, and rules', () => {
    const result = evaluateBenchmarkCase(benchmarkCase, extraction());

    expect(result.correctionNeeded).toBe(false);
    expect(result.weights.accuracy).toBe(1);
    expect(result.assessments.accuracy).toBe(1);
    expect(result.assessments.typeAccuracy).toBe(1);
    expect(result.dates.accuracy).toBe(1);
    expect(result.thresholds.accuracy).toBe(1);
    expect(result.dropRules.accuracy).toBe(1);
    expect(result.blockingIssues).toEqual([]);
    const summary = summarizeBenchmarkResults([result]);
    expect(summary.fieldMetrics.weights.precision).toBe(1);
    expect(summary.fieldMetrics.weights.recall).toBe(1);
  });

  it('audits labelled coverage separately from extraction accuracy', () => {
    const audit = auditBenchmarkDataset([benchmarkCase], ['outline.pdf', 'unlabelled.pdf']);

    expect(audit).toMatchObject({
      corpusFileCount: 2,
      labelledCaseCount: 1,
      labelledFileCount: 1,
      unlabelledFileCount: 1,
      labelCoverageRate: 0.5,
      expectedFieldCounts: {
        weights: 1,
        assessments: 1,
        dates: 1,
        thresholds: 1,
        dropRules: 1,
      },
    });
  });

  it('marks extraction mismatches and validator conflicts in the summary', () => {
    const mismatched = evaluateBenchmarkCase(
      benchmarkCase,
      extraction({
        courseIdentity: {
          courseCode: 'CS 371',
          title: 'Operating Systems',
          instructors: [],
          confidence: 0.4,
          evidence: [],
        },
        gradingScheme: {
          gradingMode: 'UNKNOWN',
          categories: [{ name: 'Final', weightPercentage: 70, confidence: 0.4, evidence: [] }],
          thresholds: [],
          dropRules: [],
        },
      }),
    );

    const summary = summarizeBenchmarkResults([mismatched]);
    expect(mismatched.correctionNeeded).toBe(true);
    expect(mismatched.blockingIssues).toContain('COURSE_MISMATCH');
    expect(summary.correctionRate).toBe(1);
    expect(summary.blockingConflictRate).toBe(1);
  });
});
