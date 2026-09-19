import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import { createPersonalOrganization } from './organization.repository';
import { organizations } from './organization.schema';
import { profileLinks, profiles } from './profile.schema';
import {
  createProfile,
  findPublicProfileBySlug,
  ProfileError,
} from './profile.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

let counter = 0;

async function freeOrg(): Promise<string> {
  counter += 1;
  const rows = await db
    .insert(users)
    .values({ email: `u${counter}@example.bg`, passwordHash: 'h', name: 'U' })
    .returning({ id: users.id });
  const userId = rows[0]?.id;
  if (userId === undefined) throw new Error('no user row');
  const org = await createPersonalOrganization(db, {
    ownerUserId: userId,
    name: 'U',
  });
  return org.id;
}

async function proOrg(planExpiresAt: Date | null = null): Promise<string> {
  const orgId = await freeOrg();
  await db
    .update(organizations)
    .set({ plan: 'pro', planExpiresAt })
    .where(eq(organizations.id, orgId));
  return orgId;
}

const base = { firstName: 'Иван', lastName: 'Петров' } as const;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProfileError) return error.code;
    throw error;
  }
  throw new Error('expected a ProfileError');
}

describe('createProfile', () => {
  it('creates a profile with links in array order', async () => {
    const orgId = await freeOrg();
    const profile = await createProfile(db, {
      orgId,
      slug: 'ivan-petrov',
      ...base,
      title: 'Управител',
      links: [
        { type: 'phone', value: '+359881234567' },
        { type: 'email', value: 'ivan@demo.bg', label: 'Пиши ми' },
      ],
    });

    expect(profile).toMatchObject({
      slug: 'ivan-petrov',
      isPublic: true,
      theme: { preset: 'light', primaryColor: null, layout: 'default' },
    });
    const links = await db
      .select()
      .from(profileLinks)
      .where(eq(profileLinks.profileId, profile.id))
      .orderBy(profileLinks.sortOrder);
    expect(links.map((l) => [l.type, l.sortOrder, l.label])).toEqual([
      ['phone', 0, null],
      ['email', 1, 'Пиши ми'],
    ]);
  });

  it('Free: a second profile hits plan_limit_profiles with a Bulgarian message', async () => {
    const orgId = await freeOrg();
    await createProfile(db, { orgId, slug: 'first-one', ...base });
    const error = await createProfile(db, {
      orgId,
      slug: 'second-one',
      ...base,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProfileError);
    expect((error as ProfileError).code).toBe('plan_limit_profiles');
    expect((error as ProfileError).message).toMatch(/профил/);
  });

  it('Free: seven links hit plan_limit_links; six pass', async () => {
    const orgId = await freeOrg();
    const link = { type: 'custom', value: 'https://x.bg' } as const;
    await expect(
      codeOf(
        createProfile(db, {
          orgId,
          slug: 'seven-links',
          ...base,
          links: Array.from({ length: 7 }, () => link),
        }),
      ),
    ).resolves.toBe('plan_limit_links');
    await expect(
      createProfile(db, {
        orgId,
        slug: 'six-links',
        ...base,
        links: Array.from({ length: 6 }, () => link),
      }),
    ).resolves.toMatchObject({ slug: 'six-links' });
  });

  it('Pro: two profiles; expired Pro behaves like Free', async () => {
    const orgId = await proOrg();
    await createProfile(db, { orgId, slug: 'pro-one', ...base });
    await expect(
      createProfile(db, { orgId, slug: 'pro-two', ...base }),
    ).resolves.toMatchObject({ slug: 'pro-two' });

    const expiredId = await proOrg(new Date(Date.now() - 1000));
    await createProfile(db, { orgId: expiredId, slug: 'exp-one', ...base });
    await expect(
      codeOf(createProfile(db, { orgId: expiredId, slug: 'exp-two', ...base })),
    ).resolves.toBe('plan_limit_profiles');
  });

  it('rejects taken, reserved and invalid slugs by code', async () => {
    const orgId = await proOrg();
    await createProfile(db, { orgId, slug: 'taken-one', ...base });
    await expect(
      codeOf(createProfile(db, { orgId, slug: 'taken-one', ...base })),
    ).resolves.toBe('slug_taken');
    await expect(
      codeOf(createProfile(db, { orgId, slug: 'admin', ...base })),
    ).resolves.toBe('slug_reserved');
    for (const slug of ['Ab', 'ab', '-abc', 'abc-', 'a b', 'a'.repeat(31)]) {
      await expect(
        codeOf(createProfile(db, { orgId, slug, ...base })),
      ).resolves.toBe('slug_invalid');
    }
  });

  it('rejects oversized or malformed fields before touching the database', async () => {
    const orgId = await freeOrg();
    const cases = [
      { firstName: '' },
      { bio: 'x'.repeat(601) },
      { theme: { preset: 'neon', primaryColor: null, layout: 'default' } },
      { theme: { preset: 'light', primaryColor: 'red', layout: 'default' } },
      { links: [{ type: 'phone', value: '' }] },
    ] as const;
    for (const extra of cases) {
      await expect(
        codeOf(
          createProfile(db, {
            orgId,
            slug: 'bad-input',
            ...base,
            ...(extra as object),
          }),
        ),
      ).resolves.toBe('input_invalid');
    }
    expect(await findPublicProfileBySlug(db, 'bad-input')).toBeNull();
  });

  it('refuses an unknown organization', async () => {
    await expect(
      codeOf(
        createProfile(db, {
          orgId: '00000000-0000-7000-8000-000000000000',
          slug: 'nobody',
          ...base,
        }),
      ),
    ).resolves.toBe('org_not_found');
  });
});

describe('findPublicProfileBySlug', () => {
  it('returns visible links in sort order and skips hidden ones', async () => {
    const orgId = await freeOrg();
    await createProfile(db, {
      orgId,
      slug: 'public-one',
      ...base,
      company: 'Демо ООД',
      links: [
        { type: 'phone', value: '1' },
        { type: 'email', value: 'hidden@x.bg', isVisible: false },
        { type: 'website', value: 'demo.bg' },
      ],
    });

    const found = await findPublicProfileBySlug(db, 'public-one');
    expect(found).not.toBeNull();
    expect(found?.company).toBe('Демо ООД');
    expect(found?.links.map((l) => l.type)).toEqual(['phone', 'website']);
    expect(found).not.toHaveProperty('orgId');
    expect(found).not.toHaveProperty('isPublic');
    expect(found).not.toHaveProperty('id');
  });

  it('returns null for hidden and for unknown profiles', async () => {
    const orgId = await freeOrg();
    await createProfile(db, {
      orgId,
      slug: 'hidden-one',
      ...base,
      isPublic: false,
    });
    expect(await findPublicProfileBySlug(db, 'hidden-one')).toBeNull();
    expect(await findPublicProfileBySlug(db, 'nqma-takyv')).toBeNull();
  });

  it('falls back to the default theme when the stored json is broken', async () => {
    const orgId = await freeOrg();
    await createProfile(db, { orgId, slug: 'broken-theme', ...base });
    await db
      .update(profiles)
      .set({ theme: { preset: 'neon' } as never })
      .where(eq(profiles.slug, 'broken-theme'));

    const found = await findPublicProfileBySlug(db, 'broken-theme');
    expect(found?.theme.preset).toBe('light');
  });
});

describe('cascade', () => {
  it('deleting the organization removes its profiles and links', async () => {
    const orgId = await freeOrg();
    const profile = await createProfile(db, {
      orgId,
      slug: 'cascade-one',
      ...base,
      links: [{ type: 'phone', value: '1' }],
    });
    await db.delete(organizations).where(eq(organizations.id, orgId));

    expect(
      await db.select().from(profiles).where(eq(profiles.id, profile.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(profileLinks)
        .where(eq(profileLinks.profileId, profile.id)),
    ).toHaveLength(0);
  });
});
