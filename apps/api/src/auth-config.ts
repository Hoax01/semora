const MIN_AUTH_SECRET_LENGTH = 32;

export function requireAuthSecret(value = process.env.BETTER_AUTH_SECRET) {
  if (!value || value.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be set to at least ${MIN_AUTH_SECRET_LENGTH} characters.`,
    );
  }
  return value;
}
