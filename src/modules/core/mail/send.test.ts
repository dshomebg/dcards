import { afterEach, describe, expect, it, vi } from 'vitest';

const envValues = vi.hoisted(() => ({
  NODE_ENV: 'test',
  MAIL_FROM: 'DCARDS <info@x.bg>',
}));
vi.mock('../env', () => ({ env: () => envValues }));
vi.mock('./transport', () => ({ mailTransport: () => null }));

const { sendMail } = await import('./send');

const message = { to: 'a@x.bg', subject: 'Тест', text: 'Здравей' };

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
    await expect(sendMail(message, transport as never)).resolves.toBe(true);
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'DCARDS <info@x.bg>',
      ...message,
    });
  });

  it('never throws and logs only name and code on failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(new Error('535 bad creds for a@x.bg'), {
      code: 'EAUTH',
    });
    const transport = { sendMail: vi.fn().mockRejectedValue(failure) };
    await expect(sendMail(message, transport as never)).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith('sendMail failed:', 'Error', 'EAUTH');
  });
});
