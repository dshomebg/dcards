'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/modules/core';
import {
  deleteProfile,
  isOrgMember,
  type ProfileEditDto,
  ProfileError,
  type ProfileTheme,
  replaceProfileLinks,
  updateProfile,
} from '@/modules/platform';

import { requireCurrent } from '../../current';
import { userActionLimit } from '../rate-limit';
import { profileFormSchema, type ProfileFormValues } from './schema';

export interface ActionFailure {
  readonly ok: false;
  readonly message: string;
}

export type SaveProfileResult =
  { readonly ok: true; readonly profile: ProfileEditDto } | ActionFailure;

const failure = (message: string): ActionFailure => ({ ok: false, message });

const ID_INVALID = 'Профилът не съществува.';

/** Празното поле във формата е `''`; в базата е `null`, за да не се рендира. */
const emptyToNull = (value: string): string | null =>
  value === '' ? null : value;

function logUnexpected(where: string, error: unknown): void {
  // Drizzle носи параметрите на заявката в `message` — само `cause` (DAT-6).
  console.error(
    `${where}:`,
    error instanceof DrizzleQueryError ? error.cause : error,
  );
}

function toServiceInput(values: ProfileFormValues) {
  return {
    fields: {
      slug: values.slug,
      firstName: values.firstName,
      lastName: values.lastName,
      title: emptyToNull(values.title),
      company: emptyToNull(values.company),
      bio: emptyToNull(values.bio),
      // Pro полетата нямат UI: не се приемат от входа, за да не се запише Pro цвят без план.
      theme: {
        preset: values.theme.preset,
        primaryColor: null,
        layout: 'default',
      } satisfies ProfileTheme,
      isPublic: values.isPublic,
    },
    links: values.links.map((link) => ({
      type: link.type,
      value: link.value,
      label: emptyToNull(link.label),
      isVisible: link.isVisible,
    })),
  };
}

/**
 * Полета + линкове в ЕДНА транзакция — два отделни action-а от един бутон
 * биха оставили полузаписан профил при втори отказ. `orgId` е само от сървъра.
 */
export async function saveProfileAction(
  profileId: unknown,
  input: unknown,
): Promise<SaveProfileResult> {
  const id = z.uuid().safeParse(profileId);
  if (!id.success) return failure(ID_INVALID);
  const parsed = profileFormSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }

  // `redirect` при липсваща сесия хвърля — затова е извън `try`.
  const { user, org } = await requireCurrent();
  const limited = await userActionLimit(user.id);
  if (limited !== null) return failure(limited);

  try {
    if (!(await isOrgMember(db, org.id, user.id))) {
      return failure('Нямаш достъп до тази организация.');
    }
    const { fields, links } = toServiceInput(parsed.data);
    const profile = await db.transaction(async (tx) => {
      const updated = await updateProfile(tx, org.id, id.data, fields);
      const saved = await replaceProfileLinks(tx, org.id, id.data, links);
      return { ...updated, links: saved };
    });
    return { ok: true, profile };
  } catch (error) {
    if (error instanceof ProfileError) return failure(error.message);
    logUnexpected('saveProfileAction', error);
    return failure('Профилът не беше записан — опитай пак след малко.');
  }
}

/** При успех пренасочва към списъка; линковете падат по cascade. */
export async function deleteProfileAction(
  profileId: unknown,
): Promise<ActionFailure> {
  const id = z.uuid().safeParse(profileId);
  if (!id.success) return failure(ID_INVALID);

  const { user, org } = await requireCurrent();
  const limited = await userActionLimit(user.id);
  if (limited !== null) return failure(limited);

  try {
    if (!(await isOrgMember(db, org.id, user.id))) {
      return failure('Нямаш достъп до тази организация.');
    }
    await deleteProfile(db, org.id, id.data);
  } catch (error) {
    if (error instanceof ProfileError) return failure(error.message);
    logUnexpected('deleteProfileAction', error);
    return failure('Профилът не беше изтрит — опитай пак след малко.');
  }

  redirect('/app');
}
