import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Platform from '@/modules/platform';

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const platform = vi.hoisted(() => ({
  findPersonalOrganizationByOwner: vi.fn(),
  isOrgMember: vi.fn(),
  setProfileImage: vi.fn(),
}));
type Consumed = { allowed: boolean; retryAfterSec: number; degraded?: boolean };
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn((_key: string): Promise<Consumed> =>
    Promise.resolve({ allowed: true, retryAfterSec: 0 }),
  ),
}));
const storage = vi.hoisted(() => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
}));

// `core` отваря пул при импорт — sharp и ключовете са истински, дискът е mock.
vi.mock('@/modules/auth', () => auth);
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  ...storage,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
  ...(await vi.importActual('@/modules/core/image/process')),
  createObjectKey: (kind: string) =>
    `${kind}/00000000-0000-4000-8000-000000000000.webp`,
}));
vi.mock('@/modules/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  ...platform,
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { ProfileError } = await import('@/modules/platform');
const { removeProfileImageAction, uploadProfileImageAction } =
  await import('./image-actions');

const user = { id: '019969a0-0000-7000-8000-000000000001', email: 'k@x.bg' };
const org = { id: '019969a0-0000-7000-8000-00000000000a', plan: 'free' };
const profileId = '019969a0-0000-7000-8000-0000000000aa';
const NEW_PHOTO = 'photos/00000000-0000-4000-8000-000000000000.webp';
const OLD_PHOTO = 'photos/11111111-1111-4111-8111-111111111111.webp';

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#A67C52' },
  })
    .png()
    .toBuffer();
}

function form(bytes: Uint8Array | Buffer, name = 'me.png', type = 'image/png') {
  const data = new FormData();
  data.set(
    'file',
    new File([bytes as Uint8Array<ArrayBuffer>], name, { type }),
  );
  return data;
}

const upload = (kind: string, data: FormData, id: unknown = profileId) =>
  uploadProfileImageAction(id, kind, data);

beforeEach(() => {
  auth.getCurrentUser.mockReset().mockResolvedValue(user);
  platform.findPersonalOrganizationByOwner.mockReset().mockResolvedValue(org);
  platform.isOrgMember.mockReset().mockResolvedValue(true);
  platform.setProfileImage.mockReset().mockResolvedValue(null);
  rateLimit.consume.mockClear();
  rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  storage.putObject.mockReset().mockResolvedValue(undefined);
  storage.deleteObject.mockReset().mockResolvedValue(undefined);
});

describe('uploadProfileImageAction', () => {
  it('stores a 512 square WebP, writes the key with the server org, deletes the old file', async () => {
    platform.setProfileImage.mockResolvedValue(OLD_PHOTO);
    const result = await upload('photo', form(await png(1200, 800)));
    expect(result).toEqual({ ok: true, key: NEW_PHOTO });

    const [key, data] = storage.putObject.mock.calls[0] as [string, Buffer];
    expect(key).toBe(NEW_PHOTO);
    const meta = await sharp(data).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([512, 512]);

    expect(platform.setProfileImage).toHaveBeenCalledWith(
      {},
      { orgId: org.id, profileId, kind: 'photo', key: NEW_PHOTO },
    );
    expect(storage.deleteObject).toHaveBeenCalledWith(OLD_PHOTO);
    expect(rateLimit.consume).toHaveBeenCalledWith(
      `rl:image-upload:user:${user.id}`,
      20,
      3600,
    );
  });

  it('keeps the logo inside 256 and under logos/', async () => {
    const result = await upload('logo', form(await png(1200, 800)));
    expect(result).toEqual({
      ok: true,
      key: 'logos/00000000-0000-4000-8000-000000000000.webp',
    });
    const [, data] = storage.putObject.mock.calls[0] as [string, Buffer];
    const meta = await sharp(data).metadata();
    expect([meta.width, meta.height]).toEqual([256, 171]);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID id and a bad kind before touching the session', async () => {
    expect((await upload('photo', form(await png(4, 4)), 'abc')).ok).toBe(
      false,
    );
    expect((await upload('banner', form(await png(4, 4)))).ok).toBe(false);
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('refuses a missing file and one over 2 MB before the limit', async () => {
    expect((await upload('photo', new FormData())).ok).toBe(false);
    const big = await upload(
      'photo',
      form(new Uint8Array(2 * 1024 * 1024 + 1)),
    );
    expect(big).toEqual({ ok: false, message: 'Файлът е до 2 MB.' });
    expect(rateLimit.consume).not.toHaveBeenCalled();
  });

  it('redirects to /login without a session', async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    await expect(upload('photo', form(await png(4, 4)))).rejects.toThrow(
      'REDIRECT:/login',
    );
  });

  it('returns the limit message on the 21st upload and writes nothing', async () => {
    rateLimit.consume.mockImplementation((key: string) =>
      Promise.resolve(
        key.startsWith('rl:image-upload')
          ? { allowed: false, retryAfterSec: 3600 }
          : { allowed: true, retryAfterSec: 0 },
      ),
    );
    const result = await upload('photo', form(await png(4, 4)));
    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 60 минути.',
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('refuses a degraded limiter instead of uploading without a cap', async () => {
    rateLimit.consume.mockResolvedValue({
      allowed: true,
      retryAfterSec: 0,
      degraded: true,
    });
    const result = await upload('photo', form(await png(4, 4)));
    expect(result.ok).toBe(false);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('judges by the bytes: SVG and HTML are refused, nothing on disk', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    for (const bad of [form(svg), form(html, 'x.png')]) {
      expect((await upload('photo', bad)).ok).toBe(false);
    }
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(platform.setProfileImage).not.toHaveBeenCalled();
  });

  it('foreign profile: the message, and the new file is deleted again', async () => {
    platform.setProfileImage.mockRejectedValue(
      new ProfileError('profile_not_found'),
    );
    const result = await upload('photo', form(await png(4, 4)));
    expect(result).toEqual({ ok: false, message: 'Профилът не съществува.' });
    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith(NEW_PHOTO);
  });

  it('hides a disk failure behind a generic message without the path', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.putObject.mockRejectedValue(
      Object.assign(new Error('/srv/secret/path'), { code: 'EACCES' }),
    );
    const result = await upload('photo', form(await png(4, 4)));
    expect(result.ok).toBe(false);
    expect(result.ok || result.message).not.toContain('/srv');
    expect(error).toHaveBeenCalledWith(
      'uploadProfileImageAction failed:',
      'Error',
      'EACCES',
    );
    error.mockRestore();
  });
});

describe('removeProfileImageAction', () => {
  it('nulls the key with the server org and deletes the old file', async () => {
    platform.setProfileImage.mockResolvedValue(OLD_PHOTO);
    expect(await removeProfileImageAction(profileId, 'photo')).toEqual({
      ok: true,
    });
    expect(platform.setProfileImage).toHaveBeenCalledWith(
      {},
      { orgId: org.id, profileId, kind: 'photo', key: null },
    );
    expect(storage.deleteObject).toHaveBeenCalledWith(OLD_PHOTO);
  });

  it('a failed delete is only logged, the result is still ok', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    platform.setProfileImage.mockResolvedValue(OLD_PHOTO);
    storage.deleteObject.mockRejectedValue(new Error('EIO'));
    expect(await removeProfileImageAction(profileId, 'logo')).toEqual({
      ok: true,
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('rejects a bad kind before the session and a foreign profile with the message', async () => {
    expect((await removeProfileImageAction(profileId, 'x')).ok).toBe(false);
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
    platform.setProfileImage.mockRejectedValue(
      new ProfileError('profile_not_found'),
    );
    expect(await removeProfileImageAction(profileId, 'photo')).toEqual({
      ok: false,
      message: 'Профилът не съществува.',
    });
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});
