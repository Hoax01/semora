import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { CatalogueImport } from './importer.js';

export type PdfTextItem = {
  str: string;
  transform: number[];
};

type ScheduleRow = {
  courseCode: string;
  title: string;
  credits: number;
  aliasOf?: string;
  sections: CatalogueImport['courses'][number]['sections'];
};

const courseCodePattern = /^[A-Z][A-Z0-9]*\s+\d+[A-Z]?$/i;
const dayMap = {
  M: 'MONDAY',
  T: 'TUESDAY',
  W: 'WEDNESDAY',
  R: 'THURSDAY',
  F: 'FRIDAY',
  S: 'SATURDAY',
  U: 'SUNDAY',
} as const;

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeCourseCode(value: string) {
  return normalizeText(value).toUpperCase();
}

function columnValue(items: PdfTextItem[], minimumX: number, maximumX: number, rowY: number) {
  return normalizeText(
    items
      .filter((item) => {
        const x = item.transform[4] ?? 0;
        const y = item.transform[5] ?? 0;
        return x >= minimumX && x < maximumX && Math.abs(y - rowY) <= 1.5;
      })
      .sort((left, right) => (left.transform[4] ?? 0) - (right.transform[4] ?? 0))
      .map((item) => item.str)
      .join(' '),
  );
}

function parseDays(value: string) {
  const normalized = value
    .replace(/SU/gi, 'U')
    .replace(/[^MTWRFSU]/gi, '')
    .toUpperCase();
  const days = [...normalized].map((day) => dayMap[day as keyof typeof dayMap]).filter(Boolean);
  return [...new Set(days)];
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})(AM|PM)$/i.exec(value);
  if (!match) throw new Error(`Unsupported LUMS schedule time: ${value}`);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (hour === 12) hour = 0;
  if (meridiem === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function meetingType(sectionCode: string) {
  const component = sectionCode.split(/\s+/)[0]?.toUpperCase();
  if (component === 'LEC') return 'LECTURE';
  if (component === 'LAB') return 'LAB';
  if (component === 'REC' || component === 'RAC') return 'TUTORIAL';
  if (component === 'SEM') return 'SEMINAR';
  return 'OTHER';
}

function parsePage(items: PdfTextItem[]) {
  const content = items.filter((item) => item.str.trim() !== '');
  const codeItems = content
    .filter(
      (item) => (item.transform[4] ?? 0) < 88 && courseCodePattern.test(normalizeText(item.str)),
    )
    .sort((left, right) => (right.transform[5] ?? 0) - (left.transform[5] ?? 0));
  const rows: ScheduleRow[] = [];

  for (const [index, codeItem] of codeItems.entries()) {
    const rowY = codeItem.transform[5] ?? 0;
    const previousY = codeItems[index - 1]?.transform[5];
    const nextY = codeItems[index + 1]?.transform[5];
    const upperBoundary = previousY === undefined ? rowY + 12 : (previousY + rowY) / 2;
    const lowerBoundary = nextY === undefined ? 0 : (rowY + nextY) / 2;
    const region = content.filter((item) => {
      const y = item.transform[5] ?? 0;
      return y <= upperBoundary && y > lowerBoundary;
    });
    const title = normalizeText(
      region
        .filter((item) => {
          const x = item.transform[4] ?? 0;
          return x >= 88 && x < 200;
        })
        .sort((left, right) => {
          const yDifference = (right.transform[5] ?? 0) - (left.transform[5] ?? 0);
          return Math.abs(yDifference) > 1.5
            ? yDifference
            : (left.transform[4] ?? 0) - (right.transform[4] ?? 0);
        })
        .map((item) => item.str)
        .join(' '),
    );
    const creditText = columnValue(region, 200, 240, rowY);
    const sectionItems = region
      .filter((item) => {
        const x = item.transform[4] ?? 0;
        return x >= 240 && x < 288 && item.str.trim() !== '';
      })
      .sort((left, right) => (right.transform[5] ?? 0) - (left.transform[5] ?? 0));
    const aliasSection = sectionItems.find((item) =>
      normalizeText(item.str).toLowerCase().startsWith('w/'),
    );
    const aliasOf = aliasSection
      ? normalizeCourseCode(normalizeText(aliasSection.str).replace(/^w\/\s*/i, ''))
      : undefined;
    const sections = aliasOf
      ? []
      : sectionItems.map((sectionItem) => {
          const sectionY = sectionItem.transform[5] ?? 0;
          const sectionCode = normalizeText(sectionItem.str);
          const days = columnValue(region, 334, 380, sectionY);
          const startTime = columnValue(region, 380, 437, sectionY);
          const endTime = columnValue(region, 437, 484, sectionY);
          const instructor = columnValue(region, 484, Number.POSITIVE_INFINITY, sectionY);
          const meetings =
            days && startTime && endTime
              ? parseDays(days).map((dayOfWeek) => ({
                  dayOfWeek,
                  startTime: parseTime(startTime),
                  endTime: parseTime(endTime),
                  meetingType: meetingType(sectionCode),
                }))
              : [];
          return {
            sectionCode,
            instructorDisplay: instructor || undefined,
            meetings,
          };
        });

    rows.push({
      courseCode: normalizeCourseCode(codeItem.str),
      title,
      credits: Number(creditText),
      ...(aliasOf ? { aliasOf } : {}),
      sections,
    });
  }

  return rows;
}

export function buildLumsCatalogue(pages: PdfTextItem[][]): CatalogueImport {
  const rows = pages.flatMap(parsePage);
  const byCode = new Map(rows.map((row) => [row.courseCode, row]));
  for (const row of rows.filter((candidate) => !candidate.aliasOf)) {
    const sectionOccurrences = new Map<string, number>();
    for (const section of row.sections) {
      const occurrence = (sectionOccurrences.get(section.sectionCode) ?? 0) + 1;
      sectionOccurrences.set(section.sectionCode, occurrence);
      if (occurrence > 1) section.sectionCode = `${section.sectionCode} (${occurrence})`;
    }
  }
  for (const row of rows) {
    if (!row.aliasOf) continue;
    const source = byCode.get(row.aliasOf);
    if (!source)
      throw new Error(`Cross-listed source ${row.aliasOf} for ${row.courseCode} was not found.`);
    row.sections = structuredClone(source.sections);
  }

  return {
    university: {
      name: 'Lahore University of Management Sciences',
      shortName: 'LUMS',
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
    },
    term: {
      name: 'Fall 2026',
      termType: 'FALL',
      academicYear: '2026-2027',
      startDate: '2026-08-27',
      endDate: '2026-12-08',
    },
    courses: rows.map((row) => ({
      courseCode: row.courseCode,
      title: row.title,
      department: row.courseCode.split(' ')[0],
      creditHoursDefault: row.credits,
      sections: row.sections,
    })),
  };
}

export async function parseLumsSchedulePdf(data: Uint8Array): Promise<CatalogueImport> {
  const document = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: PdfTextItem[][] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const text = await page.getTextContent();
    pages.push(
      text.items
        .filter((item): item is typeof item & PdfTextItem => 'str' in item)
        .map((item) => ({ str: item.str, transform: [...item.transform] })),
    );
  }

  return buildLumsCatalogue(pages);
}
