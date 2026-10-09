import { afterEach, describe, expect, it, vi } from 'vitest';

const envValues = vi.hoisted(() => ({
  NODE_ENV: 'test',
  MAIL_FROM: 'DCARDS <info@x.bg>',
}));
vi.mock('../env', () => ({ env: () => envValues }));
vi.mock('./transport', () => ({ mailTransport: () => null }));
vi.mock('../rate-limit/shared', () => ({ rateLimit: null }));

const { sendMail } = await import('./send');

const message = { to: 'a@x.bg', subject: 'Тест', text: 'Здравей' };
const allow = {
  consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
};

const silent = () => undefined;

// Главният таван е изчерпан; известието минава само ако `alertAllowed`.
function cappedAt(alertAllowed: boolean) {
  return vi.fn((key: string) =>
    Promise.resolve({
      allowed: key === 'rl:mail:cap-alert' && alertAllowed,
      retryAfterSec: 60,
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  envValues.NODE_ENV = 'test';
});

describe('sendMail', () => {
  it('prints to the console without a transport outside production', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await expect(sendMail(message)).resolves.toBe(true);
    expect(info).toHaveBeenCalledOnce();
    expect(info.mock.calls[0]?.[0]).not.toContain('a@x.bg');
  });

  it('returns false and warns once in production without a transport', async () => {
    envValues.NODE_ENV = 'production';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(sendMail(message)).resolves.toBe(false);
    await expect(sendMail(message)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('adds the sender and returns true when the transport accepts', async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue({}) };
    await expect(sendMail(message, transport as never, allow)).resolves.toBe(
      true,
    );
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'DCARDS <info@x.bg>',
      ...message,
    });
    expect(allow.consume).toHaveBeenCalledWith('rl:mail:global', 100, 3600);
  });

  it('drops the mail without touching SMTP once the global cap is reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const transport = { sendMail: vi.fn() };
    const deny = {
      consume: vi.fn(() =>
        Promise.resolve({ allowed: false, retryAfterSec: 60 }),
      ),
    };
    await expect(sendMail(message, transport as never, deny)).resolves.toBe(
      false,
    );
    expect(transport.sendMail).not.toHaveBeenCalled();
  });

  describe('with MAIL_ADMIN_TO', () => {
    const admin = 'Info@x.bg';
    const capped = (alertAllowed: boolean) => ({
      consume: cappedAt(alertAllowed),
    });

    afterEach(() => {
      delete (envValues as { MAIL_ADMIN_TO?: string }).MAIL_ADMIN_TO;
    });

    it('sends to the admin past the cap, without counting', async () => {
      Object.assign(envValues, { MAIL_ADMIN_TO: admin });
      const transport = { sendMail: vi.fn().mockResolvedValue({}) };
      const limiter = capped(false);
      const toAdmin = { ...message, to: 'info@x.bg' };
      await expect(
        sendMail(toAdmin, transport as never, limiter),
      ).resolves.toBe(true);
      expect(limiter.consume).not.toHaveBeenCalled();
    });

    it('tells the admin once per window that the cap was hit', async () => {
      vi.spyOn(console, 'error').mockImplementation(silent);
      Object.assign(envValues, { MAIL_ADMIN_TO: admin });
      const transport = { sendMail: vi.fn().mockResolvedValue({}) };

      await sendMail(message, transport as never, capped(true));
      expect(transport.sendMail).toHaveBeenCalledOnce();
      expect(transport.sendMail.mock.calls[0]?.[0]).toMatchObject({
        to: admin,
      });

      await sendMail(message, transport as never, capped(false));
      expect(transport.sendMail).toHaveBeenCalledOnce();
    });
  });

  it('never throws and logs only name and code on failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(new Error('535 bad creds for a@x.bg'), {
      code: 'EAUTH',
    });
    const transport = { sendMail: vi.fn().mockRejectedValue(failure) };
    await expect(sendMail(message, transport as never, allow)).resolves.toBe(
      false,
    );
    expect(error).toHaveBeenCalledWith('sendMail failed:', 'Error', 'EAUTH');
  });
});
