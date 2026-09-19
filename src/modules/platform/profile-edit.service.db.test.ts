import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import { createPersonalOrganization } from './organization.repository';
import { profileLinks, profiles } from './profile.schema';
import { createProfile, ProfileError } from './profile.service';
import {
  deleteProfile,
  getProfileForEdit,
  replaceProfileLinks,
  updateProfile,
} from './profile-edit.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

let counter = 0;

async function freeOrg(): Promise<string> {
  counter += 1;
  const rows = await db
    .insert(users)
    .values({ email: `e${counter}@example.bg`, passwordHash: 'h', name: 'U' })
    .returning({ id: users.id });
  const userId = rows[0]?.id;
  if (userId === undefined) throw new Error('no user row');
  const org = await createPersonalOrganization(db, {
    ownerUserId: userId,
    name: 'U',
  });
  return org.id;
}

const base = { firstName: 'Иван', lastName: 'Петров' } as const;

const fields = {
  ...base,
  title: 'Управител',
  company: 'Демо ООД',
  bio: 'Здравей.',
  theme: { preset: 'dark', primaryColor: null, layout: 'default' },
  isPublic: true,
} as const;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProfileError) return error.code;
    throw error;
  }
  throw new Error('expected a ProfileError');
}

async function seed(slug: string, links = 2) {
  const orgId = await freeOrg();
  const profile = await createProfile(db, {
    orgId,
    slug,
    ...base,
    links: Array.from({ length: links }, (_, i) => ({
      type: 'custom' as const,
      value: `https://x${i}.bg`,
      isVisible: i !== 1,
    })),
  });
  return { orgId, profile };
}

const rowOf = async (id: string) =>
  (await db.select().from(profiles).where(eq(profiles.id, id)))[0];

const linksOf = (id: string) =>
  db
    .select()
    .from(profileLinks)
    .where(eq(profileLinks.profileId, id))
    .orderBy(profileLinks.sortOrder);

describe('getProfileForEdit', () => {
  it('returns all links (hidden too) by sortOrder for the own org', async () => {
    const { orgId, profile } = await seed('edit-own', 3);
    const dto = await getProfileForEdit(db, orgId, profile.id);
    expect(dto).toMatchObject({ id: profile.id, slug: 'edit-own' });
    expect(dto?.links.map((l) => [l.sortOrder, l.isVisible])).toEqual([
      [0, true],
      [1, false],
      [2, true],
    ]);
    expect(dto).not.toHaveProperty('photoKey');
    expect(dto).not.toHaveProperty('orgId');
  });

  it('returns null for another org', async () => {
    const { profile } = await seed('edit-other');
    const stranger = await freeOrg();
    expect(await getProfileForEdit(db, stranger, profile.id)).toBeNull();
  });
});

describe('updateProfile', () => {
  it('profile_not_found for another org; the row is untouched', async () => {
    const { profile } = await seed('upd-other');
    const stranger = await freeOrg();
    const before = await rowOf(profile.id);
    await expect(
      codeOf(
        updateProfile(db, stranger, profile.id, { ...fields, slug: 'x-y-z' }),
      ),
    ).resolves.toBe('profile_not_found');
    expect(await rowOf(profile.id)).toEqual(before);
  });

  it('updates fields and bumps updatedAt', async () => {
    const { orgId, profile } = await seed('upd-own');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const dto = await updateProfile(db, orgId, profile.id, {
      ...fields,
      slug: 'upd-own-2',
      isPublic: false,
    });
    expect(dto).toMatchObject({
      slug: 'upd-own-2',
      title: 'Управител',
      isPublic: false,
      theme: { preset: 'dark' },
    });
    expect(dto.updatedAt.getTime()).toBeGreaterThan(
      profile.updatedAt.getTime(),
    );
    expect(dto.links).toHaveLength(2);
  });

  it('slug_taken for another profile slug, slug_reserved, slug_invalid', async () => {
    await seed('upd-taken');
    const { orgId, profile } = await seed('upd-mine');
    const run = (slug: string) =>
      codeOf(updateProfile(db, orgId, profile.id, { ...fields, slug }));
    await expect(run('upd-taken')).resolves.toBe('slug_taken');
    await expect(run('admin')).resolves.toBe('slug_reserved');
    await expect(run('Ab')).resolves.toBe('slug_invalid');
    expect((await rowOf(profile.id))?.slug).toBe('upd-mine');
  });

  it('keeps its own slug and rejects invalid input', async () => {
    const { orgId, profile } = await seed('upd-same');
    await expect(
      updateProfile(db, orgId, profile.id, { ...fields, slug: 'upd-same' }),
    ).resolves.toMatchObject({ slug: 'upd-same' });
    await expect(
      codeOf(
        updateProfile(db, orgId, profile.id, {
          ...fields,
          slug: 'upd-same',
          bio: 'x'.repeat(601),
        }),
      ),
    ).resolves.toBe('input_invalid');
  });
});

describe('replaceProfileLinks', () => {
  it('writes the new list with sortOrder = index and bumps updatedAt', async () => {
    const { orgId, profile } = await seed('lnk-own');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const saved = await replaceProfileLinks(db, orgId, profile.id, [
      { type: 'email', value: 'a@x.bg', label: 'Пиши' },
      { type: 'phone', value: '1', isVisible: false },
      { type: 'website', value: 'demo.bg' },
    ]);
    expect(saved.map((l) => [l.type, l.sortOrder, l.isVisible])).toEqual([
      ['email', 0, true],
      ['phone', 1, false],
      ['website', 2, true],
    ]);
    expect((await linksOf(profile.id)).map((l) => l.type)).toEqual([
      'email',
      'phone',
      'website',
    ]);
    const row = await rowOf(profile.id);
    expect(row?.updatedAt.getTime()).toBeGreaterThan(
      profile.updatedAt.getTime(),
    );
  });

  it('Free with seven links: plan_limit_links and the old links stay', async () => {
    const { orgId, profile } = await seed('lnk-limit');
    const link = { type: 'custom', value: 'https://x.bg' } as const;
    await expect(
      codeOf(
        replaceProfileLinks(
          db,
          orgId,
          profile.id,
          Array.from({ length: 7 }, () => link),
        ),
      ),
    ).resolves.toBe('plan_limit_links');
    expect(await linksOf(profile.id)).toHaveLength(2);
    await expect(
      replaceProfileLinks(
        db,
        orgId,
        profile.id,
        Array.from({ length: 6 }, () => link),
      ),
    ).resolves.toHaveLength(6);
  });

  it('profile_not_found for another org without deleting anything', async () => {
    const { profile } = await seed('lnk-other');
    const stranger = await freeOrg();
    await expect(
      codeOf(replaceProfileLinks(db, stranger, profile.id, [])),
    ).resolves.toBe('profile_not_found');
    expect(await linksOf(profile.id)).toHaveLength(2);
  });

  it('an empty list clears the links', async () => {
    const { orgId, profile } = await seed('lnk-empty');
    await expect(
      replaceProfileLinks(db, orgId, profile.id, []),
    ).resolves.toEqual([]);
    expect(await linksOf(profile.id)).toHaveLength(0);
  });
});

describe('deleteProfile', () => {
  it('removes the profile and its links', async () => {
    const { orgId, profile } = await seed('del-own');
    await deleteProfile(db, orgId, profile.id);
    expect(await rowOf(profile.id)).toBeUndefined();
    expect(await linksOf(profile.id)).toHaveLength(0);
  });

  it('profile_not_found for another org; the row stays', async () => {
    const { profile } = await seed('del-other');
    const stranger = await freeOrg();
    await expect(codeOf(deleteProfile(db, stranger, profile.id))).resolves.toBe(
      'profile_not_found',
    );
    expect(await rowOf(profile.id)).toBeDefined();
    expect(await linksOf(profile.id)).toHaveLength(2);
  });
});
