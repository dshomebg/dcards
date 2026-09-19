import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  readSession: vi.fn(),
  revokeSession: vi.fn(() => Promise.resolve()),
}));
const repository = vi.hoisted(() => ({ findById: vi.fn() }));

vi.mock('./session', () => session);
vi.mock('./user.repository', () => repository);
vi.mock('@/modules/core', () => ({ db: {} }));

const { getCurrentAdmin } = await import('./current-admin');

const admin = { id: '0199-uuid', email: 'a@x.bg', name: 'A' };

describe('getCurrentAdmin', () => {
  beforeEach(() => {
    session.readSession.mockReset();
    session.revokeSession.mockClear();
    repository.findById.mockReset();
  });

  it('returns null without a session and never touches the database', async () => {
    session.readSession.mockResolvedValue(null);
    await expect(getCurrentAdmin()).resolves.toBeNull();
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('keeps the session while the user row is still an admin', async () => {
    session.readSession.mockResolvedValue(admin);
    repository.findById.mockResolvedValue({ ...admin, isAdmin: true });
    await expect(getCurrentAdmin()).resolves.toEqual(admin);
    expect(session.revokeSession).not.toHaveBeenCalled();
  });

  it('ends the session once is_admin has been revoked', async () => {
    session.readSession.mockResolvedValue(admin);
    repository.findById.mockResolvedValue({ ...admin, isAdmin: false });
    await expect(getCurrentAdmin()).resolves.toBeNull();
    expect(session.revokeSession).toHaveBeenCalledTimes(1);
  });

  it('ends the session when the user row is gone', async () => {
    session.readSession.mockResolvedValue(admin);
    repository.findById.mockResolvedValue(null);
    await expect(getCurrentAdmin()).resolves.toBeNull();
    expect(session.revokeSession).toHaveBeenCalledTimes(1);
  });

  it('fails closed but keeps the session when the database is down', async () => {
    session.readSession.mockResolvedValue(admin);
    repository.findById.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(getCurrentAdmin()).resolves.toBeNull();
    expect(session.revokeSession).not.toHaveBeenCalled();
  });
});
