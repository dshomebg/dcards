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

describe('verify resend policy', () => {
  it('keys the resend per user at 3 an hour', () => {
    expect(rateKey.verifyResendUser('u1')).toBe('rl:verify-resend:user:u1');
    expect(RATE_POLICY.verifyResendUser).toEqual({ limit: 3, windowSec: 3600 });
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

describe('cart policy', () => {
  it('keys the guest cart actions per IP at 60 a minute', () => {
    expect(rateKey.cartIp('203.0.113.9')).toBe('rl:cart:ip:203.0.113.9');
    expect(RATE_POLICY.cartIp).toEqual({ limit: 60, windowSec: 60 });
    expect(rateKey.cartNewIp('203.0.113.9')).toBe('rl:cart-new:ip:203.0.113.9');
    expect(RATE_POLICY.cartNewIp).toEqual({ limit: 10, windowSec: 3600 });
  });
});

describe('checkout policy', () => {
  it('keys the checkout per IP and per lowercased email', () => {
    expect(rateKey.checkoutIp('203.0.113.9')).toBe(
      'rl:checkout:ip:203.0.113.9',
    );
    expect(rateKey.checkoutEmail('Ivan@X.bg')).toBe(
      'rl:checkout:email:ivan@x.bg',
    );
    expect(RATE_POLICY.checkoutIp).toEqual({ limit: 5, windowSec: 3600 });
    expect(RATE_POLICY.checkoutEmail).toEqual({ limit: 3, windowSec: 3600 });
  });
});

describe('scan policy', () => {
  it('keys the public scan records per card and per profile at 30 a minute', () => {
    expect(rateKey.scanCard('ABCD2345')).toBe('rl:scan:card:ABCD2345');
    expect(rateKey.scanProfile('p1')).toBe('rl:scan:profile:p1');
    expect(RATE_POLICY.scanCard).toEqual({ limit: 30, windowSec: 60 });
    expect(RATE_POLICY.scanProfile).toEqual({ limit: 30, windowSec: 60 });
  });
});

describe('upload policy', () => {
  it('keys the guest logo upload per IP at 10 an hour', () => {
    expect(rateKey.uploadIp('203.0.113.9')).toBe('rl:upload:ip:203.0.113.9');
    expect(RATE_POLICY.uploadIp).toEqual({ limit: 10, windowSec: 3600 });
  });
});

describe('image upload policy', () => {
  it('keys the profile image upload per user at 20 an hour', () => {
    expect(rateKey.imageUploadUser('u1')).toBe('rl:image-upload:user:u1');
    expect(RATE_POLICY.imageUploadUser).toEqual({ limit: 20, windowSec: 3600 });
  });
});

describe('invite policy', () => {
  it('keys the invitations per org at 10 an hour and the token page per IP', () => {
    expect(rateKey.inviteOrg('o1')).toBe('rl:invite:org:o1');
    expect(RATE_POLICY.inviteOrg).toEqual({ limit: 10, windowSec: 3600 });
    expect(rateKey.inviteIp('203.0.113.9')).toBe('rl:invite:ip:203.0.113.9');
    expect(RATE_POLICY.inviteIp).toEqual({ limit: 30, windowSec: 900 });
  });
});
