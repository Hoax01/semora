import { describe, expect, it } from 'vitest';
import {
  LocalDeterministicExtractionProvider,
  SchemaConstrainedExtractionProvider,
  courseDocumentExtractionSchema,
  validateCourseDocumentExtraction,
  type NormalizedDocument,
} from './index.js';

const document = {
  schemaVersion: '0.1',
  parserVersion: '0.1',
  format: 'PLAIN_TEXT',
  metadata: {
    fileName: 'outline.txt',
    mimeType: 'text/plain',
    sizeBytes: 10,
    sha256: 'hash',
    format: 'PLAIN_TEXT',
  },
  text: 'Course outline',
  pages: ['Course outline'],
  blocks: [{ kind: 'paragraph', text: 'Course outline' }],
  tables: [],
  parserWarnings: [],
} satisfies NormalizedDocument;

function extraction() {
  return {
    documentId: 'document-1',
    documentType: 'COURSE_OUTLINE' as const,
    schemaVersion: '0.1' as const,
    extractorVersion: 'test-extractor',
    modelIdentifier: 'test-model',
    courseIdentity: {
      courseCode: 'CS 370',
      title: 'Operating Systems',
      instructors: ['Instructor'],
      confidence: 0.95,
      evidence: [{ pageNumber: 1, text: 'CS 370 Operating Systems' }],
    },
    gradingScheme: {
      gradingMode: 'ABSOLUTE' as const,
      categories: [
        {
          name: 'Final',
          weightPercentage: 40,
          confidence: 0.9,
          evidence: [{ pageNumber: 2, text: 'Final 40%' }],
        },
      ],
      thresholds: [],
      dropRules: [],
    },
    assessments: [],
    warnings: [],
    conflicts: [],
    fieldConfidences: { courseIdentity: 0.95 },
    overallConfidence: 0.9,
  };
}

describe('schema-constrained extraction provider', () => {
  it('validates a provider result before returning it', async () => {
    const provider = new SchemaConstrainedExtractionProvider({
      modelIdentifier: 'test-model',
      async extractCourseDocument() {
        return extraction();
      },
    });

    await expect(
      provider.extractCourseDocument(document, { documentId: 'document-1' }),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      modelIdentifier: 'test-model',
    });
  });

  it('rejects malformed or out-of-range provider output', () => {
    expect(() =>
      courseDocumentExtractionSchema.parse({
        ...extraction(),
        overallConfidence: 1.5,
      }),
    ).toThrow();
  });

  it('rejects provider output for a different document', async () => {
    const provider = new SchemaConstrainedExtractionProvider({
      modelIdentifier: 'test-model',
      async extractCourseDocument() {
        return { ...extraction(), documentId: 'another-document' };
      },
    });

    await expect(
      provider.extractCourseDocument(document, { documentId: 'document-1' }),
    ).rejects.toThrow('another-document');
  });

  it('extracts a conservative draft locally without a network provider', async () => {
    const provider = new SchemaConstrainedExtractionProvider(
      new LocalDeterministicExtractionProvider(),
    );
    const result = await provider.extractCourseDocument(
      {
        ...document,
        text: [
          'CS 370 Operating Systems',
          'Instructor: Ada Lovelace',
          'Assignments: 30%',
          'Midterm: 30%',
          'Final Exam: 40%',
          'Absolute grading with letter grade thresholds',
        ].join('\n\n'),
        blocks: [
          { kind: 'heading', text: 'CS 370 Operating Systems' },
          { kind: 'paragraph', text: 'Instructor: Ada Lovelace' },
          { kind: 'paragraph', text: 'Assignments: 30%' },
          { kind: 'paragraph', text: 'Midterm: 30%' },
          { kind: 'paragraph', text: 'Final Exam: 40%' },
          { kind: 'paragraph', text: 'Absolute grading with letter grade thresholds' },
        ],
      },
      { documentId: 'document-1' },
    );

    expect(result.modelIdentifier).toBe('local-deterministic-v0');
    expect(result.courseIdentity.courseCode).toBe('CS 370');
    expect(result.gradingScheme.categories).toHaveLength(3);
    expect(
      result.gradingScheme.categories.every(
        (category) => category.aggregationRule === 'EQUAL_MEAN',
      ),
    ).toBe(true);
    expect(result.assessments.every((assessment) => assessment.category !== null)).toBe(true);
    expect(result.assessments.map((assessment) => assessment.type)).toEqual([
      'ASSIGNMENT',
      'MIDTERM',
      'FINAL',
    ]);
    expect(result.gradingScheme.gradingMode).toBe('ABSOLUTE');
  });

  it('requires N when a category uses a best-N or drop-lowest-N rule', () => {
    const base = courseDocumentExtractionSchema.parse(extraction());
    const category = base.gradingScheme.categories[0];
    if (!category) throw new Error('Test fixture is missing a grading category.');
    const result = validateCourseDocumentExtraction({
      ...base,
      gradingScheme: {
        ...base.gradingScheme,
        categories: [
          {
            ...category,
            aggregationRule: 'DROP_LOWEST_N',
            ruleParameterN: null,
          },
        ],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.blockingIssues).toContain('MISSING_RULE_PARAMETER_N:final');
  });

  it('rejects an assessment assigned to an unknown category', () => {
    const base = courseDocumentExtractionSchema.parse(extraction());
    const result = validateCourseDocumentExtraction({
      ...base,
      assessments: [
        {
          title: 'Quiz 1',
          type: 'QUIZ',
          category: 'Quizzes',
          weightPercentage: null,
          dueDate: null,
          recurrence: null,
          confidence: 0.8,
          evidence: [],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.blockingIssues).toContain('UNKNOWN_ASSESSMENT_CATEGORY:quizzes');
  });

  it('adds deterministic validation warnings and blocking conflicts to the draft', () => {
    const base = courseDocumentExtractionSchema.parse(extraction());
    const firstCategory = base.gradingScheme.categories[0];
    if (!firstCategory) throw new Error('Test fixture is missing a grading category.');
    const result = validateCourseDocumentExtraction(
      {
        ...base,
        courseIdentity: { ...base.courseIdentity, courseCode: 'CS 371' },
        gradingScheme: {
          ...base.gradingScheme,
          categories: [
            ...base.gradingScheme.categories,
            { ...firstCategory, name: 'Final Exam', weightPercentage: 70 },
          ],
        },
      },
      { expectedCourseCode: 'CS 370' },
    );

    expect(result.valid).toBe(false);
    expect(result.blockingIssues).toEqual(
      expect.arrayContaining(['COURSE_MISMATCH', 'WEIGHT_TOTAL_EXCEEDS_100']),
    );
    expect(result.extraction.conflicts.length).toBeGreaterThanOrEqual(2);
    expect(result.extraction.overallConfidence).toBe(0.4);
  });
});
