import { describe, expect, it } from 'vitest';
import { requireAuthSecret } from './auth-config.js';

describe('authentication configuration', () => {
  it('requires a sufficiently strong Better Auth secret', () => {
    expect(() => requireAuthSecret('')).toThrow(
      'BETTER_AUTH_SECRET must be set to at least 32 characters.',
    );
    expect(() => requireAuthSecret('too-short')).toThrow(
      'BETTER_AUTH_SECRET must be set to at least 32 characters.',
    );
    expect(requireAuthSecret('a'.repeat(32))).toBe('a'.repeat(32));
  });
});
