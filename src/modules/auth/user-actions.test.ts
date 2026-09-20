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
const rateLimit = vi.hoisted(() => ({
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
}));

vi.mock('./session', () => session);
vi.mock('./user.repository', () => repository);
vi.mock('./registration', () => registration);
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-real-ip': '203.0.113.9' })),
}));
// `client.ts` отваря пул при импорт — тук база няма; репозиторият е мокиран.
// Политиката и IP helper-ът са истински, за да се проверяват реалните ключове.
vi.mock('@/modules/core', async () => ({
  db: {},
  rateLimit,
  ...(await vi.importActual('@/modules/core/rate-limit/policy')),
  ...(await vi.importActual('@/modules/core/rate-limit/client-ip')),
}));
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

const TOO_MANY = 'Твърде много опити. Опитай след 15 минути.';

describe('signInUser', () => {
  beforeEach(() => {
    session.createSession.mockClear();
    verifySpy.mockClear();
    rateLimit.consume.mockClear();
    rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
    repository.findByEmailWithHash.mockClear();
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

  it('shares the login buckets with the admin door: lowercased email and IP', async () => {
    await expect(
      signInUser({ email: 'Member@Example.com', password: 'correct-horse-1' }),
    ).rejects.toThrow('REDIRECT:/app');

    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:login:email-ip:member@example.com:203.0.113.9',
      5,
      900,
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:login:email:member@example.com',
      30,
      3600,
    );
    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:login:ip:203.0.113.9',
      20,
      900,
    );
  });

  it('follows a safe next path and falls back to /app for anything else', async () => {
    await expect(
      signInUser(
        { email: 'member@example.com', password: 'correct-horse-1' },
        '/c/ABCD2345',
      ),
    ).rejects.toThrow('REDIRECT:/c/ABCD2345');
    await expect(
      signInUser(
        { email: 'member@example.com', password: 'correct-horse-1' },
        'https://evil.example',
      ),
    ).rejects.toThrow('REDIRECT:/app');
  });

  it('refuses a limited attempt before the database and the hash check', async () => {
    rateLimit.consume.mockResolvedValue({ allowed: false, retryAfterSec: 900 });

    const result = await signInUser({
      email: 'member@example.com',
      password: 'correct-horse-1',
    });

    expect(result).toEqual({ ok: false, message: TOO_MANY });
    expect(repository.findByEmailWithHash).not.toHaveBeenCalled();
    expect(verifySpy).not.toHaveBeenCalled();
    expect(session.createSession).not.toHaveBeenCalled();
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
    rateLimit.consume.mockClear();
    rateLimit.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  });

  it('rejects invalid input without touching the database', async () => {
    const result = await register({ ...valid, password: 'short' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/8/);
    expect(registration.registerAccount).not.toHaveBeenCalled();
    expect(rateLimit.consume).not.toHaveBeenCalled();
  });

  it('counts registrations by IP only', async () => {
    registration.registerAccount.mockResolvedValue({ status: 'email_taken' });
    await register(valid);

    expect(rateLimit.consume).toHaveBeenCalledTimes(1);
    expect(rateLimit.consume).toHaveBeenCalledWith(
      'rl:register:ip:203.0.113.9',
      3,
      3600,
    );
  });

  it('refuses a limited IP without touching registerAccount', async () => {
    rateLimit.consume.mockResolvedValue({
      allowed: false,
      retryAfterSec: 3600,
    });

    const result = await register(valid);

    expect(result).toEqual({
      ok: false,
      message: 'Твърде много опити. Опитай след 60 минути.',
    });
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

  it('follows a safe next path after registration', async () => {
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

    await expect(register(valid, '/c/ABCD2345')).rejects.toThrow(
      'REDIRECT:/c/ABCD2345',
    );
    await expect(register(valid, '//evil.example')).rejects.toThrow(
      'REDIRECT:/app',
    );
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
