import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseLumsSchedulePdf } from './catalogue/lums-schedule.js';

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  throw new Error('Usage: npm run catalogue:convert-lums -- <schedule.pdf> <catalogue.json>');
}

const repositoryRoot = path.resolve(process.cwd(), '../..');
const source = await readFile(path.resolve(repositoryRoot, inputPath));
const catalogue = await parseLumsSchedulePdf(new Uint8Array(source));
await writeFile(
  path.resolve(repositoryRoot, outputPath),
  `${JSON.stringify(catalogue, null, 2)}\n`,
  'utf8',
);

console.log(`Converted ${catalogue.courses.length} course codes to ${outputPath}.`);
