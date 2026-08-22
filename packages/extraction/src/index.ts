import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mammoth from 'mammoth';
import {
  DEFAULT_MAX_DOCUMENT_BYTES,
  EXTRACTION_PARSER_VERSION,
  EXTRACTION_SCHEMA_VERSION,
} from './constants.js';

export {
  DEFAULT_MAX_DOCUMENT_BYTES,
  EXTRACTION_PARSER_VERSION,
  EXTRACTION_SCHEMA_VERSION,
} from './constants.js';

export type DocumentFormat = 'PDF' | 'DOCX' | 'PLAIN_TEXT';

export type StoredFile = {
  fileName: string;
  mimeType: string;
  data: Uint8Array;
};

export type DocumentMetadata = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  format: DocumentFormat;
};

export type DocumentBlock = {
  kind: 'heading' | 'paragraph';
  text: string;
  pageNumber?: number;
  headingLevel?: number;
};

export type DocumentTable = {
  rows: string[][];
  pageNumber?: number;
};

export type NormalizedDocument = {
  schemaVersion: string;
  parserVersion: string;
  format: DocumentFormat;
  metadata: DocumentMetadata;
  text: string;
  pages: string[];
  blocks: DocumentBlock[];
  tables: DocumentTable[];
  parserWarnings: string[];
};

export type ExtractionParseErrorCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'PARSING_FAILED'
  | 'NO_EXTRACTABLE_CONTENT';

export class ExtractionParseError extends Error {
  readonly code: ExtractionParseErrorCode;

  constructor(code: ExtractionParseErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ExtractionParseError';
    this.code = code;
  }
}

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

type PdfLine = {
  text: string;
  fontSize: number;
};

const PDF_MIME_TYPES = new Set(['application/pdf']);
const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const TEXT_MIME_TYPES = new Set(['text/plain']);

function extensionOf(fileName: string) {
  const extension = fileName.toLowerCase().split('.').pop();
  return extension ?? '';
}

export function detectDocumentFormat(
  file: Pick<StoredFile, 'fileName' | 'mimeType'>,
): DocumentFormat {
  const extension = extensionOf(file.fileName);
  if (PDF_MIME_TYPES.has(file.mimeType) || extension === 'pdf') return 'PDF';
  if (DOCX_MIME_TYPES.has(file.mimeType) || extension === 'docx') return 'DOCX';
  if (TEXT_MIME_TYPES.has(file.mimeType) || extension === 'txt') return 'PLAIN_TEXT';
  throw new ExtractionParseError(
    'UNSUPPORTED_FORMAT',
    `Unsupported document format for ${file.fileName}. Use PDF, DOCX, or plain text.`,
  );
}

function metadataFor(file: StoredFile, format: DocumentFormat): DocumentMetadata {
  return {
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.data.byteLength,
    sha256: createHash('sha256').update(file.data).digest('hex'),
    format,
  };
}

function ensureReadableFile(file: StoredFile, maxBytes: number) {
  if (file.data.byteLength === 0) {
    throw new ExtractionParseError('EMPTY_FILE', 'The uploaded document is empty.');
  }
  if (file.data.byteLength > maxBytes) {
    throw new ExtractionParseError(
      'FILE_TOO_LARGE',
      `The uploaded document exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`,
    );
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePlainText(file: StoredFile, metadata: DocumentMetadata): NormalizedDocument {
  const text = new TextDecoder().decode(file.data).replace(/\r\n?/g, '\n');
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => cleanText(block))
    .filter(Boolean)
    .map((block) => ({ kind: 'paragraph' as const, text: block }));
  if (!blocks.length) {
    throw new ExtractionParseError('NO_EXTRACTABLE_CONTENT', 'No text could be extracted.');
  }
  return {
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    parserVersion: EXTRACTION_PARSER_VERSION,
    format: 'PLAIN_TEXT',
    metadata,
    text: blocks.map((block) => block.text).join('\n\n'),
    pages: [blocks.map((block) => block.text).join('\n\n')],
    blocks,
    tables: [],
    parserWarnings: [],
  };
}

function groupPdfTextItems(items: PdfTextItem[]): PdfLine[] {
  const sortedItems = items
    .filter((item) => cleanText(item.str))
    .map((item) => ({
      item,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
      fontSize: Math.max(Math.abs(item.transform[0] ?? 0), item.height),
    }))
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const lines: Array<{ y: number; items: typeof sortedItems }> = [];
  for (const item of sortedItems) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) < 2.5);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => ({
      text: cleanText(
        line.items
          .sort((left, right) => left.x - right.x)
          .map((item) => item.item.str)
          .join(' '),
      ),
      fontSize: Math.max(...line.items.map((item) => item.fontSize)),
    }))
    .filter((line) => line.text);
}

function looksLikePdfHeading(line: PdfLine) {
  return (
    line.fontSize >= 15 || (line.text.length <= 70 && /^[A-Z][A-Z\s&/:\-–—0-9]+$/.test(line.text))
  );
}

async function normalizePdf(
  file: StoredFile,
  metadata: DocumentMetadata,
): Promise<NormalizedDocument> {
  try {
    const document = await getDocument({
      data: new Uint8Array(file.data),
      useSystemFonts: true,
    }).promise;
    const pages: string[] = [];
    const blocks: DocumentBlock[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items
        .filter((item): item is typeof item & PdfTextItem => 'str' in item && 'transform' in item)
        .map((item) => ({
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height,
        }));
      const lines = groupPdfTextItems(items);
      const pageText = lines.map((line) => line.text).join('\n');
      pages.push(pageText);
      blocks.push(
        ...lines.map((line) =>
          looksLikePdfHeading(line)
            ? { kind: 'heading' as const, text: line.text, pageNumber, headingLevel: 2 }
            : { kind: 'paragraph' as const, text: line.text, pageNumber },
        ),
      );
      page.cleanup();
    }
    const text = pages.filter(Boolean).join('\n\n').trim();
    if (!text) {
      throw new ExtractionParseError(
        'NO_EXTRACTABLE_CONTENT',
        'No text could be extracted from the PDF.',
      );
    }
    return {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      parserVersion: EXTRACTION_PARSER_VERSION,
      format: 'PDF',
      metadata,
      text,
      pages,
      blocks,
      tables: [],
      parserWarnings: [],
    };
  } catch (error) {
    if (error instanceof ExtractionParseError) throw error;
    throw new ExtractionParseError('PARSING_FAILED', 'The PDF could not be parsed.', {
      cause: error,
    });
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDocxHtml(html: string) {
  const tables: DocumentTable[] = [];
  const htmlWithoutTables = html.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
    const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
      [...row[0].matchAll(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi)]
        .map((cell) => decodeHtml(cell[0]))
        .filter(Boolean),
    );
    if (rows.length) tables.push({ rows });
    return '\n';
  });
  const blocks: DocumentBlock[] = [];
  for (const match of htmlWithoutTables.matchAll(/<(h([1-6])|p)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = decodeHtml(match[3] ?? '');
    if (!text) continue;
    const headingLevel = match[2] ? Number(match[2]) : undefined;
    blocks.push(
      headingLevel ? { kind: 'heading', text, headingLevel } : { kind: 'paragraph', text },
    );
  }
  return { blocks, tables };
}

async function normalizeDocx(
  file: StoredFile,
  metadata: DocumentMetadata,
): Promise<NormalizedDocument> {
  try {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(file.data) });
    const { blocks, tables } = normalizeDocxHtml(result.value);
    const text = blocks.map((block) => block.text).join('\n\n');
    if (!text && !tables.length) {
      throw new ExtractionParseError(
        'NO_EXTRACTABLE_CONTENT',
        'No text could be extracted from the DOCX.',
      );
    }
    const tableText = tables
      .map((table) => table.rows.map((row) => row.join(' | ')).join('\n'))
      .join('\n\n');
    const combinedText = [text, tableText].filter(Boolean).join('\n\n');
    return {
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      parserVersion: EXTRACTION_PARSER_VERSION,
      format: 'DOCX',
      metadata,
      text: combinedText,
      pages: combinedText ? [combinedText] : [],
      blocks,
      tables,
      parserWarnings: result.messages.map((message) => message.message),
    };
  } catch (error) {
    if (error instanceof ExtractionParseError) throw error;
    throw new ExtractionParseError('PARSING_FAILED', 'The DOCX could not be parsed.', {
      cause: error,
    });
  }
}

export async function parseDocument(
  file: StoredFile,
  options: { maxBytes?: number } = {},
): Promise<NormalizedDocument> {
  ensureReadableFile(file, options.maxBytes ?? DEFAULT_MAX_DOCUMENT_BYTES);
  const format = detectDocumentFormat(file);
  const metadata = metadataFor(file, format);
  if (format === 'PLAIN_TEXT') return normalizePlainText(file, metadata);
  if (format === 'PDF') return normalizePdf(file, metadata);
  return normalizeDocx(file, metadata);
}

export * from './provider.js';
export * from './local-provider.js';
export * from './validation.js';
export * from './benchmark.js';
export * from './corrections.js';
