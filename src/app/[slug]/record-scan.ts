// Записът на QR/директно отваряне на `/{slug}` — само от `ProfilePage`, не от
// `generateMetadata`. Никога не хвърля: страницата е по-важна от реда.

import { db } from '@/modules/core';
import {
  classifyDevice,
  insertScan,
  logScanFailure,
  type PublicProfileRecord,
} from '@/modules/platform';

import { profileScanLimited } from './rate-limit';
import { scanSourceFor } from './scan-source';

export async function recordProfileScan(
  record: PublicProfileRecord,
  headers: Headers,
  s: string | string[] | undefined,
  seenSlug: string | undefined,
): Promise<void> {
  const source = scanSourceFor(headers, s, seenSlug === record.profile.slug);
  if (source === null) return;
  if (await profileScanLimited(record.id)) return;
  try {
    await insertScan(db, {
      cardId: null,
      profileId: record.id,
      orgId: record.orgId,
      source,
      device: classifyDevice(headers.get('user-agent')),
      country: null,
    });
  } catch (error) {
    logScanFailure('/[slug]', error);
  }
}
