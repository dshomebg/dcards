import type * as Argon2 from 'argon2';
import { hash } from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegisterResult } from './registration';
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
const registration = vi.hoisted(() => ({
  registerAccount:
    vi.fn<(db: unknown, input: unknown) => Promise<RegisterResult>>(),
}));

vi.mock('./session', () => session);
vi.mock('./user.repository', () => repository);
vi.mock('./registration', () => registration);
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

const { register, signInUser, signOutUser } = await import('./user-actions');

const ADMIN_ID = '019969a0-0000-7000-8000-000000000001';
const MEMBER_ID = '019969a0-0000-7000-8000-000000000002';
const passwordHash = await hash('correct-horse-1');
const REJECTED = 'Грешен имейл или парола.';

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

describe('signInUser', () => {
  beforeEach(() => {
    session.createSession.mockClear();
    verifySpy.mockClear();
    repository.findByEmailWithHash.mockImplementation((_db, email) => {
      const lower = email.toLowerCase();
      if (lower === 'admin@example.com') return Promise.resolve(user({}));
      if (lower === 'member@example.com') {
        return Promise.resolve(
          user({ id: MEMBER_ID, email: 'member@example.com', isAdmin: false }),
        );
      }
      return Promise.resolve(null);
    });
  });

  it('rejects an unknown email with the same message and still runs the hash check', async () => {
    const result = await signInUser({
      email: 'nobody@example.com',
      password: 'x',
    });

    expect(result).toEqual({ ok: false, message: REJECTED });
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(session.createSession).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with the same message', async () => {
    const result = await signInUser({
      email: 'member@example.com',
      password: 'x',
    });

    expect(result).toEqual({ ok: false, message: REJECTED });
    expect(session.createSession).not.toHaveBeenCalled();
  });

  it('rejects malformed input without touching the hash', async () => {
    const result = await signInUser({ email: 'not-an-email', password: '' });
    expect(result.ok).toBe(false);
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('lets a non-admin in and redirects to /app', async () => {
    await expect(
      signInUser({ email: 'Member@Example.com', password: 'correct-horse-1' }),
    ).rejects.toThrow('REDIRECT:/app');

    expect(session.createSession).toHaveBeenCalledWith({
      id: MEMBER_ID,
      email: 'member@example.com',
      name: 'Администратор',
    });
  });

  it('lets an admin in through the same door', async () => {
    await expect(
      signInUser({ email: 'admin@example.com', password: 'correct-horse-1' }),
    ).rejects.toThrow('REDIRECT:/app');
    expect(session.createSession).toHaveBeenCalledTimes(1);
  });
});

describe('signOutUser', () => {
  it('redirects to /login when the session is gone', async () => {
    session.destroySession.mockResolvedValueOnce(true);
    await expect(signOutUser()).rejects.toThrow('REDIRECT:/login');
  });

  it('reports failure when the session could not be destroyed', async () => {
    session.destroySession.mockResolvedValueOnce(false);
    const result = await signOutUser();
    expect(result.ok).toBe(false);
  });
});

describe('register', () => {
  const valid = { name: 'Кирил', email: 'k@x.bg', password: 'correct-horse-1' };

  beforeEach(() => {
    session.createSession.mockReset();
    session.createSession.mockResolvedValue(undefined);
    registration.registerAccount.mockReset();
  });

  it('rejects invalid input without touching the database', async () => {
    const result = await register({ ...valid, password: 'short' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/8/);
    expect(registration.registerAccount).not.toHaveBeenCalled();
  });

  it('tells the user when the email is taken', async () => {
    registration.registerAccount.mockResolvedValue({ status: 'email_taken' });
    const result = await register(valid);
    expect(result).toEqual({
      ok: false,
      message: 'Този имейл вече е регистриран.',
    });
    expect(session.createSession).not.toHaveBeenCalled();
  });

  it('opens a session with public fields only and redirects to /app', async () => {
    registration.registerAccount.mockResolvedValue({
      status: 'created',
      user: {
        id: MEMBER_ID,
        email: 'k@x.bg',
        name: 'Кирил',
        emailVerifiedAt: null,
        isAdmin: false,
        createdAt: new Date(),
      },
    });

    await expect(register(valid)).rejects.toThrow('REDIRECT:/app');
    expect(session.createSession).toHaveBeenCalledWith({
      id: MEMBER_ID,
      email: 'k@x.bg',
      name: 'Кирил',
    });
  });

  it('points to /login when the account exists but the session could not open', async () => {
    registration.registerAccount.mockResolvedValue({
      status: 'created',
      user: {
        id: MEMBER_ID,
        email: 'k@x.bg',
        name: 'Кирил',
        emailVerifiedAt: null,
        isAdmin: false,
        createdAt: new Date(),
      },
    });
    session.createSession.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await register(valid);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/\/login/);
  });
});
