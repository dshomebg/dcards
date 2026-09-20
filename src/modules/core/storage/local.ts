// Файловете са на локален том под `UPLOADS_DIR` (ARC-4). Интерфейсът е тесен
// нарочно — S3 би сменил само този файл. Ключът се ражда тук, не от клиента.

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { env } from '../env';

/** Единственият приеман ключ — без него няма `join` с клиентски вход. */
export const OBJECT_KEY_PATTERN = /^logos\/[0-9a-f-]{36}\.webp$/;

export function isObjectKey(key: string): boolean {
  return OBJECT_KEY_PATTERN.test(key);
}

export function createLogoKey(): string {
  return `logos/${randomUUID()}.webp`;
}

class StorageKeyError extends Error {
  constructor() {
    super('Invalid storage key');
    this.name = 'StorageKeyError';
  }
}

function pathOf(key: string): string {
  if (!isObjectKey(key)) throw new StorageKeyError();
  return join(env().UPLOADS_DIR, key);
}

function isMissing(error: unknown): boolean {
  return (error as { code?: string } | undefined)?.code === 'ENOENT';
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  const path = pathOf(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/** `null` при липса или лош ключ — извикващият връща 404, не 500. */
export async function readObject(key: string): Promise<Buffer | null> {
  if (!isObjectKey(key)) return null;
  try {
    return await readFile(pathOf(key));
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!isObjectKey(key)) return;
  try {
    await unlink(pathOf(key));
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}
