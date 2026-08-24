import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { prisma } from './db.js';
import { requireAuthSecret } from './auth-config.js';

if (!prisma) {
  throw new Error('DATABASE_URL must be set before initializing authentication.');
}

const authSecret = requireAuthSecret();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
  trustedOrigins: [process.env.APP_URL ?? 'http://localhost:5173'],
  emailAndPassword: {
    enabled: true,
  },
  secret: authSecret,
});
