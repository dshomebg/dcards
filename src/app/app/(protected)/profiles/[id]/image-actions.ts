'use server';

// Снимката и логото се записват ВЕДНАГА при избор, не със „Запази": файл →
// диск → ключ в базата → старият файл се трие. Приема файл, никога ключ.

import { DrizzleQueryError } from 'drizzle-orm';
import { z } from 'zod';

import {
  createObjectKey,
  db,
  deleteObject,
  IMAGE_MAX_BYTES,
  ImageError,
  processLogo,
  processPhoto,
  putObject,
} from '@/modules/core';
import {
  isOrgMember,
  PROFILE_IMAGE_KINDS,
  ProfileError,
  type ProfileImageKind,
  setProfileImage,
} from '@/modules/platform';

import { requireCurrent } from '../../current';
import { imageUploadLimit, userActionLimit } from '../../rate-limit';

interface Failure {
  readonly ok: false;
  readonly message: string;
}

export type UploadProfileImageResult =
  { readonly ok: true; readonly key: string } | Failure;
export type RemoveProfileImageResult = { readonly ok: true } | Failure;

const failure = (message: string): Failure => ({ ok: false, message });

const ID_INVALID = 'Профилът не съществува.';
const NO_ACCESS = 'Нямаш достъп до тази организация.';
const FAILED = 'Изображението не беше записано — опитай пак след малко.';

const argsSchema = z.object({
  profileId: z.uuid(),
  kind: z.enum(PROFILE_IMAGE_KINDS),
});

const PROCESS = { photo: processPhoto, logo: processLogo } as const;
const FOLDER = { photo: 'photos', logo: 'logos' } as const;

/** Само име и код — байтовете, името на файла и ключът не влизат в лога. */
function logUnexpected(where: string, error: unknown): void {
  const err = (error instanceof DrizzleQueryError ? error.cause : error) as
    { name?: string; code?: string } | undefined;
  console.error(`${where} failed:`, err?.name, err?.code);
}

/** Провалът на триене е само лог — сирачето не бива да връща грешка на човека. */
/** Провалът на триене е лог, не грешка — редът в базата е вече верен. */
export async function deleteQuietly(key: string | null): Promise<void> {
  if (key === null) return;
  try {
    await deleteObject(key);
  } catch (error) {
    logUnexpected('deleteObject', error);
  }
}

/** Общият таван първо; качването има и свой (sharp + диск), 20/час. */
async function authorize(): Promise<{ orgId: string } | { message: string }> {
  const { user, org } = await requireCurrent();
  const limited =
    (await userActionLimit(user.id)) ?? (await imageUploadLimit(user.id));
  if (limited !== null) return { message: limited };
  if (!(await isOrgMember(db, org.id, user.id))) return { message: NO_ACCESS };
  return { orgId: org.id };
}

async function store(
  input: { orgId: string; profileId: string; kind: ProfileImageKind },
  file: File,
): Promise<UploadProfileImageResult> {
  const webp = await PROCESS[input.kind](Buffer.from(await file.arrayBuffer()));
  const key = createObjectKey(FOLDER[input.kind]);
  await putObject(key, webp);
  try {
    const previous = await setProfileImage(db, { ...input, key });
    await deleteQuietly(previous);
    return { ok: true, key };
  } catch (error) {
    // Записът в базата не мина — новият файл не бива да остане сираче.
    await deleteQuietly(key);
    throw error;
  }
}

export async function uploadProfileImageAction(
  profileId: unknown,
  kind: unknown,
  formData: FormData,
): Promise<UploadProfileImageResult> {
  const args = argsSchema.safeParse({ profileId, kind });
  if (!args.success) return failure(ID_INVALID);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return failure('Избери файл с изображение.');
  }
  // Преди лимита: отказът на голям файл не струва нищо и не бива да брои.
  if (file.size > IMAGE_MAX_BYTES) return failure('Файлът е до 2 MB.');

  // `redirect` при липсваща сесия хвърля — затова е извън `try`.
  const auth = await authorize();
  if ('message' in auth) return failure(auth.message);

  try {
    return await store({ ...args.data, orgId: auth.orgId }, file);
  } catch (error) {
    if (error instanceof ImageError || error instanceof ProfileError) {
      return failure(error.message);
    }
    logUnexpected('uploadProfileImageAction', error);
    return failure(FAILED);
  }
}

export async function removeProfileImageAction(
  profileId: unknown,
  kind: unknown,
): Promise<RemoveProfileImageResult> {
  const args = argsSchema.safeParse({ profileId, kind });
  if (!args.success) return failure(ID_INVALID);

  const { user, org } = await requireCurrent();
  const limited = await userActionLimit(user.id);
  if (limited !== null) return failure(limited);

  try {
    if (!(await isOrgMember(db, org.id, user.id))) return failure(NO_ACCESS);
    const previous = await setProfileImage(db, {
      ...args.data,
      orgId: org.id,
      key: null,
    });
    await deleteQuietly(previous);
    return { ok: true };
  } catch (error) {
    if (error instanceof ProfileError) return failure(error.message);
    logUnexpected('removeProfileImageAction', error);
    return failure(FAILED);
  }
}
