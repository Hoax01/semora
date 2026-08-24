import { describe, expect, it } from 'vitest';
import { formatCatalogueImportFailure } from './import-cli.js';

describe('catalogue import CLI failures', () => {
  it('turns malformed JSON into a concise recovery message', () => {
    expect(formatCatalogueImportFailure(new SyntaxError('Unexpected token'))).toBe(
      'Catalogue file is not valid JSON.',
    );
  });

  it('preserves actionable validation errors', () => {
    expect(formatCatalogueImportFailure(new Error('courses[0].courseCode is required'))).toBe(
      'courses[0].courseCode is required',
    );
  });

  it('handles unknown thrown values without exposing a stack', () => {
    expect(formatCatalogueImportFailure({ reason: 'unavailable' })).toBe(
      'Unknown catalogue import error.',
    );
  });
});
