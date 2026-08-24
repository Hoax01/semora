import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from './generated/prisma/client.js';
import { formatCatalogueImportFailure } from './catalogue/import-cli.js';
import { importCatalogue } from './catalogue/importer.js';

config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '../../.env') });

async function main() {
  const inputPath = process.argv[2];
  const connectionString = process.env.DATABASE_URL;

  if (!inputPath) throw new Error('Usage: npm run catalogue:import -- <path-to-json>');
  if (!connectionString) throw new Error('DATABASE_URL must be set before importing a catalogue.');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const candidatePaths = [
      path.resolve(process.cwd(), inputPath),
      path.resolve(process.cwd(), '../../', inputPath),
    ];
    let resolvedInputPath: string | undefined;
    for (const candidatePath of candidatePaths) {
      try {
        await access(candidatePath);
        resolvedInputPath = candidatePath;
        break;
      } catch {
        // Try the next workspace-relative candidate.
      }
    }
    if (!resolvedInputPath) throw new Error(`Catalogue file not found: ${inputPath}`);
    const raw = await readFile(resolvedInputPath, 'utf8');
    const result = await importCatalogue(prisma, JSON.parse(raw));
    console.log(`Imported ${result.courseCount} courses into ${result.academicTermId}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Catalogue import failed: ${formatCatalogueImportFailure(error)}`);
  process.exitCode = 1;
});
