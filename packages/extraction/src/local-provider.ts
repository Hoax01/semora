import type {
  CourseDocumentExtraction,
  ExtractionContext,
  RawAcademicExtractionProvider,
} from './provider.js';
import type { NormalizedDocument } from './index.js';

const COURSE_CODE_PATTERN = /\b[A-Z]{2,6}\s*[- ]?\s*\d{3,4}\b/i;
const WEIGHT_PATTERN = /^(.{1,140}?)\s*(?:[:|\-–—]|\s)\s*(\d{1,3}(?:\.\d+)?)\s*%\s*$/;
const THRESHOLD_PATTERN =
  /^(A\+?|A-|B\+?|B-|C\+?|C-|D\+?|D-|F)\s*(?:>=|:|-|–|—|\s)\s*(\d{1,3}(?:\.\d+)?)/i;

type EvidenceLine = {
  text: string;
  pageNumber?: number;
};

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeCourseCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[\s-]+/g, ' ')
    .trim();
}

function evidenceFor(line: EvidenceLine) {
  return {
    ...(line.pageNumber ? { pageNumber: line.pageNumber } : {}),
    text: line.text.slice(0, 500),
  };
}

function linesFor(document: NormalizedDocument): EvidenceLine[] {
  const blocks = document.blocks.flatMap((block) =>
    block.text
      .split(/\r?\n/)
      .map((text) =>
        block.pageNumber === undefined
          ? { text: clean(text) }
          : { text: clean(text), pageNumber: block.pageNumber },
      )
      .filter((line) => line.text),
  );
  const tableLines = document.tables.flatMap((table) =>
    table.rows
      .map((row) =>
        table.pageNumber === undefined
          ? { text: clean(row.join(' | ')) }
          : { text: clean(row.join(' | ')), pageNumber: table.pageNumber },
      )
      .filter((line) => line.text),
  );
  return [...blocks, ...tableLines];
}

function titleFromCourseLine(line: string, code: string) {
  const withoutCode = clean(
    line
      .replace(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
      .replace(/^(course\s*(code|title)?|title)\s*[:\-–—]?\s*/i, ''),
  );
  return withoutCode && !/^course\s*code$/i.test(withoutCode) ? withoutCode : null;
}

function assessmentType(name: string): CourseDocumentExtraction['assessments'][number]['type'] {
  const normalized = name.toLowerCase();
  if (normalized.includes('final')) return 'FINAL';
  if (normalized.includes('midterm') || normalized.includes('mid-term')) return 'MIDTERM';
  if (normalized.includes('quiz') || normalized.includes('test')) return 'QUIZ';
  if (normalized.includes('assignment') || normalized.includes('homework')) return 'ASSIGNMENT';
  if (normalized.includes('project')) return 'PROJECT';
  if (normalized.includes('presentation')) return 'PRESENTATION';
  if (normalized.includes('participation') || normalized.includes('attendance')) {
    return 'PARTICIPATION';
  }
  return 'OTHER';
}

function gradingMode(text: string): CourseDocumentExtraction['gradingScheme']['gradingMode'] {
  if (/pass\s*[/\-]?\s*fail|satisfactory\s*[/\-]?\s*unsatisfactory/i.test(text)) {
    return 'PASS_FAIL';
  }
  if (/relative\s+grading|graded\s+on\s+a\s+curve|curve\s+grading/i.test(text)) {
    return 'RELATIVE';
  }
  if (/absolute\s+grading|letter\s+grade|grade\s+threshold|grading\s+scale/i.test(text)) {
    return 'ABSOLUTE';
  }
  return 'UNKNOWN';
}

function uniqueByName<T extends { name: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class LocalDeterministicExtractionProvider implements RawAcademicExtractionProvider {
  readonly modelIdentifier = 'local-deterministic-v0';

  async extractCourseDocument(
    document: NormalizedDocument,
    context: ExtractionContext,
  ): Promise<unknown> {
    const lines = linesFor(document);
    const fullText = document.text || lines.map((line) => line.text).join('\n');
    const codeMatch = fullText.match(COURSE_CODE_PATTERN);
    const courseCode = codeMatch ? normalizeCourseCode(codeMatch[0]) : null;
    const codeLine = codeMatch
      ? lines.find(
          (line) => COURSE_CODE_PATTERN.test(line.text) && line.text.includes(codeMatch[0]),
        )
      : undefined;
    const titleLine = lines.find((line) => /course\s+title|^title\s*:/i.test(line.text));
    const title = titleLine
      ? clean(titleLine.text.replace(/^.*?(?:course\s+title|title)\s*[:\-–—]\s*/i, '')) || null
      : codeLine && courseCode
        ? titleFromCourseLine(codeLine.text, codeMatch?.[0] ?? courseCode)
        : null;

    const instructors = lines
      .filter((line) => /^(instructors?|faculty|professors?)\s*[:\-–—]/i.test(line.text))
      .flatMap((line) =>
        line.text
          .replace(/^(instructors?|faculty|professors?)\s*[:\-–—]\s*/i, '')
          .split(/\s*(?:,|;|\band\b)\s*/i)
          .map(clean)
          .filter(Boolean),
      )
      .slice(0, 20);

    const categories = uniqueByName(
      lines.flatMap((line) => {
        const match = line.text.match(WEIGHT_PATTERN);
        if (!match) return [];
        const name = clean(match[1] ?? '').replace(
          /^(grading|weight|assessment)\s*[:\-–—]?\s*/i,
          '',
        );
        const weight = Number(match[2]);
        if (!name || /^(total|grade|grading scale|thresholds?)$/i.test(name) || weight > 100) {
          return [];
        }
        return [
          {
            name,
            weightPercentage: weight,
            confidence: 0.7,
            evidence: [evidenceFor(line)],
          },
        ];
      }),
    ).map((category) => ({
      ...category,
      aggregationRule: 'EQUAL_MEAN' as const,
      ruleParameterN: null,
    }));

    const assessments = categories.map((category) => {
      const recurrence = category.evidence[0]?.text.match(/\b(weekly|biweekly|recurring)\b/i)?.[1];
      return {
        title: category.name,
        category: category.name,
        type: assessmentType(category.name),
        weightPercentage: category.weightPercentage,
        dueDate: null,
        recurrence: recurrence ?? null,
        confidence: 0.55,
        evidence: category.evidence,
      };
    });

    const thresholds = lines.flatMap((line) => {
      const match = line.text.match(THRESHOLD_PATTERN);
      if (!match) return [];
      return [
        {
          label: (match[1] ?? '').toUpperCase(),
          minimumPercentage: Number(match[2]),
          confidence: 0.65,
          evidence: [evidenceFor(line)],
        },
      ];
    });

    const dropRules = lines
      .filter((line) =>
        /\b(drop|lowest|discard|remove)\b.{0,80}\b(assignment|quiz|score|grade)s?\b/i.test(
          line.text,
        ),
      )
      .map((line) => line.text.slice(0, 500))
      .slice(0, 30);

    const warnings: CourseDocumentExtraction['warnings'] = [];
    if (!courseCode) {
      warnings.push({
        code: 'COURSE_CODE_NOT_FOUND',
        severity: 'MEDIUM',
        message: 'The local extractor could not identify a course code.',
        evidence: [],
      });
    }
    if (!categories.length) {
      warnings.push({
        code: 'NO_GRADING_WEIGHTS',
        severity: 'HIGH',
        message: 'The local extractor could not identify percentage-based grading categories.',
        evidence: [],
      });
    }
    const mode = gradingMode(fullText);
    if (mode === 'UNKNOWN') {
      warnings.push({
        code: 'GRADING_MODE_UNKNOWN',
        severity: 'LOW',
        message: 'The grading mode could not be determined from the outline text.',
        evidence: [],
      });
    }

    const fieldConfidences = {
      courseIdentity: courseCode || title || instructors.length ? 0.65 : 0.2,
      gradingScheme: categories.length || thresholds.length ? 0.65 : 0.2,
      assessments: assessments.length ? 0.55 : 0.2,
    };
    const overallConfidence = Math.min(
      fieldConfidences.courseIdentity,
      fieldConfidences.gradingScheme,
      fieldConfidences.assessments,
    );

    return {
      documentId: context.documentId,
      documentType: 'COURSE_OUTLINE',
      schemaVersion: '0.1',
      extractorVersion: '0.1',
      modelIdentifier: this.modelIdentifier,
      courseIdentity: {
        courseCode,
        title,
        instructors,
        confidence: fieldConfidences.courseIdentity,
        evidence: [
          ...(codeLine && codeMatch ? [evidenceFor(codeLine)] : []),
          ...(titleLine ? [evidenceFor(titleLine)] : []),
        ],
      },
      gradingScheme: {
        gradingMode: mode,
        categories,
        thresholds,
        dropRules,
      },
      assessments,
      warnings,
      conflicts: [],
      fieldConfidences,
      overallConfidence,
    } satisfies CourseDocumentExtraction;
  }
}
