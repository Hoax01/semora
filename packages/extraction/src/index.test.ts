import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ExtractionParseError,
  detectDocumentFormat,
  parseDocument,
  type StoredFile,
} from './index.js';

function file(overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    fileName: 'outline.txt',
    mimeType: 'text/plain',
    data: new TextEncoder().encode('Course Outline\n\nFinal Examination — 40%'),
    ...overrides,
  };
}

function pdfWithText(text: string) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length + 31} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function minimalDocx() {
  const files = [
    [
      '[Content_Types].xml',
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ],
    [
      'word/document.xml',
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>GRADING STRUCTURE</w:t></w:r></w:p><w:p><w:r><w:t>Final Examination 40%</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Assignments</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>20%</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
    ],
  ].map(([name, content]) => ({ name: name ?? '', data: new TextEncoder().encode(content ?? '') }));
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const size = file.data.byteLength;
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(Buffer.concat([local, Buffer.from(file.data)]));

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.byteLength + size;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

describe('document normalization', () => {
  it('detects supported formats by MIME type or extension', () => {
    expect(
      detectDocumentFormat({ fileName: 'outline.pdf', mimeType: 'application/octet-stream' }),
    ).toBe('PDF');
    expect(
      detectDocumentFormat({
        fileName: 'outline.docx',
        mimeType: 'application/octet-stream',
      }),
    ).toBe('DOCX');
    expect(detectDocumentFormat({ fileName: 'outline.txt', mimeType: 'text/plain' })).toBe(
      'PLAIN_TEXT',
    );
  });

  it('normalizes plain text into paragraphs and deterministic metadata', async () => {
    const input = file();
    const normalized = await parseDocument(input);
    expect(normalized.format).toBe('PLAIN_TEXT');
    expect(normalized.blocks).toEqual([
      { kind: 'paragraph', text: 'Course Outline' },
      { kind: 'paragraph', text: 'Final Examination — 40%' },
    ]);
    expect(normalized.metadata.sha256).toBe(createHash('sha256').update(input.data).digest('hex'));
    expect(normalized.pages).toHaveLength(1);
  });

  it('extracts PDF text with page references and heading hints', async () => {
    const normalized = await parseDocument(
      file({
        fileName: 'outline.pdf',
        mimeType: 'application/pdf',
        data: pdfWithText('GRADING STRUCTURE'),
      }),
    );
    expect(normalized.format).toBe('PDF');
    expect(normalized.pages).toEqual(['GRADING STRUCTURE']);
    expect(normalized.blocks[0]).toMatchObject({
      kind: 'heading',
      text: 'GRADING STRUCTURE',
      pageNumber: 1,
    });
  });

  it('normalizes DOCX paragraphs and table rows', async () => {
    const normalized = await parseDocument(
      file({
        fileName: 'outline.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: minimalDocx(),
      }),
    );
    expect(normalized.format).toBe('DOCX');
    expect(normalized.blocks).toEqual([
      { kind: 'heading', text: 'GRADING STRUCTURE', headingLevel: 1 },
      { kind: 'paragraph', text: 'Final Examination 40%' },
    ]);
    expect(normalized.tables).toEqual([{ rows: [['Assignments', '20%']] }]);
    expect(normalized.text).toContain('Assignments | 20%');
  });

  it('rejects empty, oversized, unsupported, and unreadable documents clearly', async () => {
    await expect(parseDocument(file({ data: new Uint8Array() }))).rejects.toMatchObject({
      code: 'EMPTY_FILE',
    });
    await expect(
      parseDocument(file({ data: new Uint8Array(11) }), { maxBytes: 10 }),
    ).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
    await expect(
      parseDocument(file({ fileName: 'outline.xlsx', mimeType: 'application/vnd.ms-excel' })),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FORMAT' });
    await expect(
      parseDocument(
        file({
          fileName: 'outline.pdf',
          mimeType: 'application/pdf',
          data: new TextEncoder().encode('not pdf'),
        }),
      ),
    ).rejects.toBeInstanceOf(ExtractionParseError);
  });
});
