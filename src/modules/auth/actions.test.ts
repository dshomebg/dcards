import type * as Argon2 from 'argon2';
import { hash } from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from './user.schema';

const session = vi.hoisted(() => ({
  createSession: vi.fn(() => Promise.resolve()),
  destroySession: vi.fn(() => Promise.resolve(true)),
}));
const verifySpy = vi.hoisted(() => vi.fn());
const repository = vi.hoisted(() => ({
  findByEmailWithHash:
    vi.fn<(db: unknown, email: string) => Promise<User | null>>(),
}));

vi.mock('./session', () => session);
vi.mock('./user.repository', () => repository);
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
// `client.ts` отваря пул при импорт — тук база няма; репозиторият е мокиран.
vi.mock('@/modules/core', () => ({ db: {} }));
vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof Argon2>();
  verifySpy.mockImplementation(actual.verify);
  return { ...actual, verify: verifySpy };
});

const { signIn, signOut } = await import('./actions');

const ADMIN_ID = '019969a0-0000-7000-8000-000000000001';
const passwordHash = await hash('correct-horse-1');

function user(overrides: Partial<User>): User {
  return {
    id: ADMIN_ID,
    email: 'admin@example.com',
    name: 'Администратор',
    passwordHash,
    emailVerifiedAt: null,
    isAdmin: true,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('signIn', () => {
  beforeEach(() => {
    session.createSession.mockClear();
    verifySpy.mockClear();
    repository.findByEmailWithHash.mockImplementation((_db, email) => {
      const lower = email.toLowerCase();
      if (lower === 'admin@example.com') return Promise.resolve(user({}));
      if (lower === 'member@example.com') {
        return Promise.resolve(
          user({ id: '019969a0-0000-7000-8000-000000000002', isAdmin: false }),
        );
      }
      return Promise.resolve(null);
    });
  });

  it('rejects an unknown email with the same message and still runs the hash check', async () => {
    const result = await signIn({ email: 'nobody@example.com', password: 'x' });

    expect(result).toEqual({ ok: false, message: 'Грешен имейл или парола.' });
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(session.createSession).not.toHaveBeenCalled();
  });

  it('rejects a non-admin user exactly like an unknown email, even with the right password', async () => {
    const result = await signIn({
      email: 'member@example.com',
      password: 'correct-horse-1',
    });

    expect(result).toEqual({ ok: false, message: 'Грешен имейл или парола.' });
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(session.createSession).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with the same message', async () => {
    const result = await signIn({ email: 'admin@example.com', password: 'x' });

    expect(result).toEqual({ ok: false, message: 'Грешен имейл или парола.' });
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(session.createSession).not.toHaveBeenCalled();
  });

  it('rejects malformed input without touching the hash', async () => {
    const result = await signIn({ email: 'not-an-email', password: '' });

    expect(result.ok).toBe(false);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('opens a session with only public fields and redirects to the dashboard', async () => {
    await expect(
      signIn({ email: 'Admin@Example.com', password: 'correct-horse-1' }),
    ).rejects.toThrow('REDIRECT:/admin');

    expect(session.createSession).toHaveBeenCalledWith({
      id: ADMIN_ID,
      email: 'admin@example.com',
      name: 'Администратор',
    });
  });
});

describe('signOut', () => {
  it('redirects to the login page when the session is gone', async () => {
    session.destroySession.mockResolvedValueOnce(true);
    await expect(signOut()).rejects.toThrow('REDIRECT:/admin/login');
  });

  it('reports failure instead of pretending when the session could not be destroyed', async () => {
    session.destroySession.mockResolvedValueOnce(false);
    const result = await signOut();
    expect(result.ok).toBe(false);
  });
});
