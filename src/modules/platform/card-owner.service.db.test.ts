import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import {
  codeOf,
  rowOf,
  seedCard,
  seedOrg,
} from './card-activation.db-fixtures';
import {
  assignCardProfile,
  disableCardByOrg,
  listCardsByOrg,
  unassignCardProfile,
} from './card-activation.service';
import { deleteProfile } from './profile-edit.service';
import { insertScan } from './scan.repository';
import { scans } from './scan.schema';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

describe('assignCardProfile / unassignCardProfile / disableCardByOrg', () => {
  it('links, relinks, unlinks and disables only inside the org', async () => {
    const mine = await seedOrg('own-mine');
    const other = await seedOrg('own-other');
    const card = await seedCard(mine.userId, 'assigned', mine.org.id);

    await assignCardProfile(db, {
      cardId: card.id,
      orgId: mine.org.id,
      profileId: mine.profile.id,
    });
    const linked = await rowOf(card.id);
    expect(linked).toMatchObject({
      status: 'active',
      profileId: mine.profile.id,
    });
    expect(linked?.activatedAt).toBeInstanceOf(Date);

    // Чужд профил и чужда org — нищо не се пише, едно и също съобщение.
    expect(
      await codeOf(
        assignCardProfile(db, {
          cardId: card.id,
          orgId: mine.org.id,
          profileId: other.profile.id,
        }),
      ),
    ).toBe('card_not_found');
    expect(
      await codeOf(
        unassignCardProfile(db, { cardId: card.id, orgId: other.org.id }),
      ),
    ).toBe('card_not_found');
    expect(
      await codeOf(
        disableCardByOrg(db, { cardId: card.id, orgId: other.org.id }),
      ),
    ).toBe('card_not_found');
    expect((await rowOf(card.id))?.profileId).toBe(mine.profile.id);

    await unassignCardProfile(db, { cardId: card.id, orgId: mine.org.id });
    expect(await rowOf(card.id)).toMatchObject({
      status: 'assigned',
      profileId: null,
    });

    await disableCardByOrg(db, { cardId: card.id, orgId: mine.org.id });
    expect((await rowOf(card.id))?.status).toBe('disabled');
    expect(
      await codeOf(
        disableCardByOrg(db, { cardId: card.id, orgId: mine.org.id }),
      ),
    ).toBe('card_not_found');
  });

  it('lists the org cards with the profile, newest activation first', async () => {
    const { userId, org, profile } = await seedOrg('own-list');
    const linked = await seedCard(userId, 'assigned', org.id);
    const bare = await seedCard(userId, 'assigned', org.id);
    await assignCardProfile(db, {
      cardId: linked.id,
      orgId: org.id,
      profileId: profile.id,
    });

    // `activated_at desc`: в Postgres NULL е „най-голям" и неактивираната води.
    const list = await listCardsByOrg(db, org.id);
    expect(list.map((c) => c.id)).toEqual([bare.id, linked.id]);
    expect(list.find((c) => c.id === linked.id)?.profile).toEqual({
      id: profile.id,
      name: 'Иван Петров',
      slug: 'own-list',
    });
    expect(list.find((c) => c.id === bare.id)?.profile).toBeNull();
  });
});

describe('scans', () => {
  it('keeps the scan with profile_id null after the profile is deleted', async () => {
    const { userId, org, profile } = await seedOrg('scan-null');
    const card = await seedCard(userId, 'active', org.id);
    await insertScan(db, {
      cardId: card.id,
      profileId: profile.id,
      source: 'nfc',
      device: 'ios',
      country: null,
    });
    await deleteProfile(db, org.id, profile.id);

    const rows = await db.select().from(scans).where(eq(scans.cardId, card.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ profileId: null, device: 'ios' });
  });
});
