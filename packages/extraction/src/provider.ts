import { z } from 'zod';
import { EXTRACTION_SCHEMA_VERSION } from './constants.js';
import type { NormalizedDocument } from './index.js';

const confidenceSchema = z.number().finite().min(0).max(1);
const evidenceSchema = z.object({
  pageNumber: z.number().int().positive().optional(),
  text: z.string().trim().min(1).max(500),
});

const courseIdentitySchema = z.object({
  courseCode: z.string().trim().min(1).max(40).nullable(),
  title: z.string().trim().min(1).max(200).nullable(),
  instructors: z.array(z.string().trim().min(1).max(160)).max(20),
  confidence: confidenceSchema,
  evidence: z.array(evidenceSchema).max(20),
});

const gradingCategorySchema = z.object({
  name: z.string().trim().min(1).max(160),
  weightPercentage: z.number().finite().min(0).max(100).nullable(),
  confidence: confidenceSchema,
  evidence: z.array(evidenceSchema).max(20),
});

const gradeThresholdSchema = z.object({
  label: z.string().trim().min(1).max(20),
  minimumPercentage: z.number().finite().min(0).max(100),
  confidence: confidenceSchema,
  evidence: z.array(evidenceSchema).max(20),
});

const gradingSchemeSchema = z.object({
  gradingMode: z.enum(['ABSOLUTE', 'RELATIVE', 'PASS_FAIL', 'UNKNOWN']),
  categories: z.array(gradingCategorySchema).max(50),
  thresholds: z.array(gradeThresholdSchema).max(30),
  dropRules: z.array(z.string().trim().min(1).max(500)).max(30),
});

const assessmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum([
    'ASSIGNMENT',
    'QUIZ',
    'PROJECT',
    'PRESENTATION',
    'MIDTERM',
    'FINAL',
    'PARTICIPATION',
    'OTHER',
  ]),
  weightPercentage: z.number().finite().min(0).max(100).nullable(),
  dueDate: z.string().date().nullable(),
  recurrence: z.string().trim().max(160).nullable(),
  confidence: confidenceSchema,
  evidence: z.array(evidenceSchema).max(20),
});

const warningSchema = z.object({
  code: z.string().trim().min(1).max(80),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  message: z.string().trim().min(1).max(500),
  evidence: z.array(evidenceSchema).max(20),
});

const conflictSchema = z.object({
  field: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
  values: z.array(z.string().trim().min(1).max(200)).max(20),
  evidence: z.array(evidenceSchema).max(20),
});

export const courseDocumentExtractionSchema = z.object({
  documentId: z.string().trim().min(1),
  documentType: z.literal('COURSE_OUTLINE'),
  schemaVersion: z.literal(EXTRACTION_SCHEMA_VERSION),
  extractorVersion: z.string().trim().min(1).max(80),
  modelIdentifier: z.string().trim().min(1).max(120),
  courseIdentity: courseIdentitySchema,
  gradingScheme: gradingSchemeSchema,
  assessments: z.array(assessmentSchema).max(100),
  warnings: z.array(warningSchema).max(100),
  conflicts: z.array(conflictSchema).max(100),
  fieldConfidences: z.record(z.string(), confidenceSchema),
  overallConfidence: confidenceSchema,
});

export type CourseDocumentExtraction = z.infer<typeof courseDocumentExtractionSchema>;

export type ExtractionContext = {
  documentId: string;
  courseCode?: string;
  courseTitle?: string;
};

export interface AcademicExtractionProvider {
  readonly modelIdentifier: string;
  extractCourseDocument(
    document: NormalizedDocument,
    context: ExtractionContext,
  ): Promise<CourseDocumentExtraction>;
}

export interface RawAcademicExtractionProvider {
  readonly modelIdentifier: string;
  extractCourseDocument(document: NormalizedDocument, context: ExtractionContext): Promise<unknown>;
}

export class SchemaConstrainedExtractionProvider implements AcademicExtractionProvider {
  readonly modelIdentifier: string;

  constructor(private readonly provider: RawAcademicExtractionProvider) {
    this.modelIdentifier = provider.modelIdentifier;
  }

  async extractCourseDocument(
    document: NormalizedDocument,
    context: ExtractionContext,
  ): Promise<CourseDocumentExtraction> {
    const result = await this.provider.extractCourseDocument(document, context);
    return courseDocumentExtractionSchema.parse(result);
  }
}
