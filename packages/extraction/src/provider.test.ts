import { describe, expect, it } from 'vitest';
import {
  SchemaConstrainedExtractionProvider,
  courseDocumentExtractionSchema,
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
});
