import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  readSession: vi.fn(),
  revokeSession: vi.fn(() => Promise.resolve()),
}));
const repository = vi.hoisted(() => ({ findById: vi.fn() }));

vi.mock('./session', () => session);
vi.mock('./user.repository', () => repository);
vi.mock('@/modules/core', () => ({ db: {} }));

const { getCurrentUser } = await import('./current-user');

const user = { id: '0199-uuid', email: 'k@x.bg', name: 'K' };

describe('getCurrentUser', () => {
  beforeEach(() => {
    session.readSession.mockReset();
    session.revokeSession.mockClear();
    repository.findById.mockReset();
  });

  it('returns null without a session and never touches the database', async () => {
    session.readSession.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('returns the session while the row exists, admin or not', async () => {
    session.readSession.mockResolvedValue(user);
    repository.findById.mockResolvedValue({ ...user, isAdmin: false });
    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(session.revokeSession).not.toHaveBeenCalled();
  });

  it('revokes the session when the user row is gone', async () => {
    session.readSession.mockResolvedValue(user);
    repository.findById.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(session.revokeSession).toHaveBeenCalledTimes(1);
  });

  it('fails closed but keeps the session when the database is down', async () => {
    session.readSession.mockResolvedValue(user);
    repository.findById.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(session.revokeSession).not.toHaveBeenCalled();
  });
});
