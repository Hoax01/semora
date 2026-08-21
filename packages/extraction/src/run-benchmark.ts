import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  benchmarkErrorResult,
  evaluateBenchmarkCase,
  summarizeBenchmarkResults,
  type BenchmarkCase,
} from './benchmark.js';
import { parseDocument } from './index.js';
import { LocalDeterministicExtractionProvider } from './local-provider.js';
import { SchemaConstrainedExtractionProvider } from './provider.js';

type BenchmarkDataset = {
  version: string;
  source: string;
  semester: string;
  cases: BenchmarkCase[];
};

async function existingDirectory(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported working-directory layout.
    }
  }
  return null;
}

const dataset = JSON.parse(
  await readFile(new URL('../benchmarks/lums-fall-2026.json', import.meta.url), 'utf8'),
) as BenchmarkDataset;
const repositoryRoot = path.resolve(process.cwd(), '../..');
const outlineDirectory = await existingDirectory([
  path.resolve(repositoryRoot, 'LUMS_data/outlines'),
  path.resolve(process.cwd(), 'LUMS_data/outlines'),
]);

if (!outlineDirectory) {
  throw new Error(
    'Benchmark corpus not found. Provide the local LUMS_data/outlines directory before running the opt-in benchmark.',
  );
}

const provider = new SchemaConstrainedExtractionProvider(
  new LocalDeterministicExtractionProvider(),
);
const results = [];
for (const benchmarkCase of dataset.cases) {
  try {
    const filePath = path.join(outlineDirectory, benchmarkCase.fileName);
    const document = await parseDocument({
      fileName: benchmarkCase.fileName,
      mimeType: 'application/pdf',
      data: await readFile(filePath),
    });
    const extraction = await provider.extractCourseDocument(document, {
      documentId: benchmarkCase.id,
      courseCode: benchmarkCase.expected.courseCode,
    });
    results.push(evaluateBenchmarkCase(benchmarkCase, extraction));
  } catch (error) {
    results.push(benchmarkErrorResult(benchmarkCase, error));
  }
}

const summary = summarizeBenchmarkResults(results);
console.log(`Phase 5.10 extraction benchmark — ${dataset.semester}`);
console.log(`Cases: ${summary.successfulCaseCount}/${summary.caseCount} extracted successfully`);
console.log(
  `Correction proxy: ${summary.correctionRate === null ? 'n/a' : `${(summary.correctionRate * 100).toFixed(1)}%`}`,
);
console.log(
  `Blocking conflict rate: ${summary.blockingConflictRate === null ? 'n/a' : `${(summary.blockingConflictRate * 100).toFixed(1)}%`}`,
);
console.log(JSON.stringify(summary, null, 2));
console.log('\nPer-case results:');
for (const result of results) {
  console.log(
    `${result.id}: ${result.error ? `ERROR (${result.error})` : result.correctionNeeded ? 'REVIEW_MISMATCH' : 'MATCH'}`,
  );
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ dataset, summary, results }, null, 2));
}
