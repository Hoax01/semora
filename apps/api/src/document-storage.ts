import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_STORAGE_DIRECTORY = path.resolve(process.cwd(), 'storage');

function storageRoot() {
  return path.resolve(process.env.SEMORA_FILE_STORAGE_PATH ?? DEFAULT_STORAGE_DIRECTORY);
}

function privateStoragePath(storageKey: string) {
  const root = storageRoot();
  const absolutePath = path.resolve(root, ...storageKey.split('/'));
  const rootPrefix = root + path.sep;
  if (!absolutePath.startsWith(rootPrefix)) {
    throw new Error('Invalid private document storage key.');
  }
  return absolutePath;
}

function safeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'user';
}

export function safeOriginalFilename(fileName: string) {
  const normalized = fileName.replaceAll('\\', '/');
  const baseName = path
    .basename(normalized)
    .replace(/[\u0000-\u001f]/g, '')
    .trim();
  const safeName = baseName.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 160);
  return safeName || 'course-outline';
}

export async function storePrivateDocument(input: {
  ownerId: string;
  originalFilename: string;
  data: Uint8Array;
}) {
  const safeName = safeOriginalFilename(input.originalFilename);
  const storageKey = path.posix.join(
    'documents',
    safeStorageSegment(input.ownerId),
    `${randomUUID()}-${safeName}`,
  );
  const absolutePath = privateStoragePath(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.data, { flag: 'wx' });
  return { storageKey, absolutePath, originalFilename: safeName };
}

export async function removePrivateDocument(storageKey: string) {
  const absolutePath = privateStoragePath(storageKey);
  await rm(absolutePath, { force: true });
}

export function privateDocumentPath(storageKey: string) {
  return privateStoragePath(storageKey);
}
