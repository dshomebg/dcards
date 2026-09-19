import type * as Argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  createSession: vi.fn(() => Promise.resolve()),
  destroySession: vi.fn(() => Promise.resolve(true)),
}));
const verifySpy = vi.hoisted(() => vi.fn());

vi.mock('./session', () => session);
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock('@/modules/core', () => ({
  env: () => ({
    ADMIN_BOOTSTRAP_EMAIL: 'admin@example.com',
    ADMIN_BOOTSTRAP_PASSWORD: 'correct-horse-1',
  }),
}));
vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof Argon2>();
  verifySpy.mockImplementation(actual.verify);
  return { ...actual, verify: verifySpy };
});

const { signIn, signOut } = await import('./actions');

describe('signIn', () => {
  beforeEach(() => {
    session.createSession.mockClear();
    verifySpy.mockClear();
  });

  it('rejects an unknown email with the same message and still runs the hash check', async () => {
    const result = await signIn({ email: 'nobody@example.com', password: 'x' });

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
      id: 'bootstrap',
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
