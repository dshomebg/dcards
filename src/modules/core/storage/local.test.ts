import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const dir = vi.hoisted(() => ({ path: '' }));

vi.mock('../env', () => ({ env: () => ({ UPLOADS_DIR: dir.path }) }));

const {
  createLogoKey,
  createObjectKey,
  deleteObject,
  isObjectKey,
  putObject,
  readObject,
} = await import('./local');

beforeAll(async () => {
  dir.path = await mkdtemp(join(tmpdir(), 'dcards-storage-'));
});

afterAll(async () => {
  await rm(dir.path, { recursive: true, force: true });
});

describe('storage keys', () => {
  it('generates a logo key that passes its own check', () => {
    const key = createLogoKey();
    expect(key).toMatch(/^logos\/[0-9a-f-]{36}\.webp$/);
    expect(isObjectKey(key)).toBe(true);
  });

  it('generates a photo key under its own folder', () => {
    const key = createObjectKey('photos');
    expect(key).toMatch(/^photos\/[0-9a-f-]{36}\.webp$/);
    expect(isObjectKey(key)).toBe(true);
  });

  it('refuses traversal, other prefixes and other extensions', () => {
    for (const bad of [
      '../x',
      'logos/../../etc/passwd',
      'logos/x.webp',
      'photos/../x',
      'avatars/00000000-0000-0000-0000-000000000000.webp',
      'logos/00000000-0000-0000-0000-000000000000.png',
      'logos/00000000-0000-0000-0000-000000000000.webp/../x',
    ]) {
      expect(isObjectKey(bad)).toBe(false);
    }
  });
});

describe('putObject / readObject / deleteObject', () => {
  it('writes under UPLOADS_DIR, creating the folder, and reads it back', async () => {
    const key = createLogoKey();
    await putObject(key, Buffer.from('webp-bytes'));
    expect((await readFile(join(dir.path, key))).toString()).toBe('webp-bytes');
    expect((await readObject(key))?.toString()).toBe('webp-bytes');
  });

  it('keeps the two kinds in separate folders', async () => {
    const key = createObjectKey('photos');
    await putObject(key, Buffer.from('photo-bytes'));
    expect((await readFile(join(dir.path, key))).toString()).toBe(
      'photo-bytes',
    );
    expect(key.startsWith('photos/')).toBe(true);
  });

  it('returns null for a missing file and for a bad key', async () => {
    expect(await readObject(createLogoKey())).toBeNull();
    expect(await readObject('../x')).toBeNull();
  });

  it('rejects a bad key on write without touching the disk', async () => {
    await expect(putObject('../x', Buffer.from('x'))).rejects.toThrow(
      'Invalid storage key',
    );
  });

  it('deletes silently, also when the file is already gone', async () => {
    const key = createLogoKey();
    await putObject(key, Buffer.from('x'));
    await deleteObject(key);
    expect(await readObject(key)).toBeNull();
    await expect(deleteObject(key)).resolves.toBeUndefined();
    await expect(deleteObject('../x')).resolves.toBeUndefined();
  });
});
