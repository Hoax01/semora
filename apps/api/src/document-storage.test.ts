import { describe, expect, it } from 'vitest';
import { privateDocumentPath, safeOriginalFilename } from './document-storage.js';

describe('private document storage', () => {
  it('removes path traversal and control characters from original filenames', () => {
    expect(safeOriginalFilename('..\\..\\outline\u0000.pdf')).toBe('outline.pdf');
    expect(safeOriginalFilename('')).toBe('course-outline');
  });

  it('rejects storage keys that escape the private storage root', () => {
    expect(() => privateDocumentPath('../outside.txt')).toThrow(
      'Invalid private document storage key.',
    );
  });
});
