import { afterEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ deleteObject: vi.fn() }));
vi.mock('@/modules/core', () => core);

const { deleteFilesQuietly } = await import('./delete-files');

afterEach(() => {
  vi.restoreAllMocks();
  core.deleteObject.mockReset();
});

describe('deleteFilesQuietly', () => {
  it('deletes every key, skips null and never throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    core.deleteObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('EIO'));
    await expect(
      deleteFilesQuietly(['photos/a.webp', null, 'logos/b.webp']),
    ).resolves.toBeUndefined();
    expect(core.deleteObject.mock.calls).toEqual([
      ['photos/a.webp'],
      ['logos/b.webp'],
    ]);
    expect(console.error).toHaveBeenCalledOnce();
  });
});
