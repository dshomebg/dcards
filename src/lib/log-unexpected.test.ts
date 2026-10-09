import { DrizzleQueryError } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { logUnexpected } from './log-unexpected';

const logged = () => JSON.stringify(vi.mocked(console.error).mock.calls);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logUnexpected', () => {
  it('keeps only code and constraint from a database error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cause = Object.assign(new Error('dup'), {
      code: '23505',
      constraint_name: 'users_email_unique',
      detail: 'Key (email)=(ivan@x.bg) already exists.',
    });
    logUnexpected(
      'saveAction',
      new DrizzleQueryError('insert … ivan@x.bg', ['ivan@x.bg'], cause),
    );
    expect(console.error).toHaveBeenCalledWith(
      'saveAction: db error',
      '23505',
      'users_email_unique',
    );
    expect(logged()).not.toContain('ivan@x.bg');
  });

  it('drops the message of any other error but keeps name, code and frames', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(new Error('guest@x.bg'), { code: 'EACCES' });
    logUnexpected('inviteAction', error);
    expect(logged()).not.toContain('guest@x.bg');
    expect(logged()).toContain('EACCES');
    expect(logged()).toContain('log-unexpected.test');
  });

  it('drops every line of a multi-line message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logUnexpected('x', new Error('first\nguest@x.bg\nthird'));
    expect(logged()).not.toContain('guest@x.bg');
    expect(logged()).not.toContain('third');
  });

  it('survives a thrown non-error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logUnexpected('x', null);
    expect(console.error).toHaveBeenCalledWith(
      'x:',
      'error',
      undefined,
      undefined,
    );
  });
});
