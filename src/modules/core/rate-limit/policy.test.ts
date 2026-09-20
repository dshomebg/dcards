import { describe, expect, it } from 'vitest';

import { RATE_POLICY, rateKey, tooManyMessage } from './policy';

describe('rateKey', () => {
  it('lowercases the email so the case does not split the bucket', () => {
    expect(rateKey.loginEmail('Admin@Example.com')).toBe(
      'rl:login:email:admin@example.com',
    );
  });
});

describe('tooManyMessage', () => {
  it('rounds up to whole minutes with a floor of one', () => {
    expect(tooManyMessage(0)).toBe('Твърде много опити. Опитай след 1 минути.');
    expect(tooManyMessage(61)).toBe(
      'Твърде много опити. Опитай след 2 минути.',
    );
    expect(tooManyMessage(900)).toBe(
      'Твърде много опити. Опитай след 15 минути.',
    );
  });
});

describe('rateKey.passwordChangeUser', () => {
  it('keys the password change per user', () => {
    expect(rateKey.passwordChangeUser('u1')).toBe('rl:password:user:u1');
  });
});

describe('claim policy', () => {
  it('keys the claim per user and per card', () => {
    expect(rateKey.claimUser('u1')).toBe('rl:claim:user:u1');
    expect(rateKey.claimCard('ABCD2345')).toBe('rl:claim:card:ABCD2345');
  });

  it('allows 5 tries per card and 10 per user in an hour', () => {
    expect(RATE_POLICY.claimCard).toEqual({ limit: 5, windowSec: 3600 });
    expect(RATE_POLICY.claimUser).toEqual({ limit: 10, windowSec: 3600 });
  });
});
