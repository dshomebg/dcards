import { describe, expect, it } from 'vitest';

import { rateKey, tooManyMessage } from './policy';

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
