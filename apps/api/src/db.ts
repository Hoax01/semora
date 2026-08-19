import path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '../../.env') });

const connectionString = process.env.DATABASE_URL;

export const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : undefined;

export async function checkDatabaseConnection() {
  if (!prisma) {
    throw new Error('DATABASE_URL must be set to check the database connection.');
  }

  await prisma.$queryRaw`SELECT 1`;
}
