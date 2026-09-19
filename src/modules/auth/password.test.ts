import { describe, expect, it } from 'vitest';

import { ARGON2_OPTIONS, hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('embeds the pinned argon2id parameters in every hash', async () => {
    const hashed = await hashPassword('correct-horse-1');
    const { memoryCost, timeCost, parallelism } = ARGON2_OPTIONS;

    expect(hashed).toContain(
      `$argon2id$v=19$m=${memoryCost},p=${parallelism},t=${timeCost}$`,
    );
    await expect(verifyPassword(hashed, 'correct-horse-1')).resolves.toBe(true);
    await expect(verifyPassword(hashed, 'wrong')).resolves.toBe(false);
  });
});
