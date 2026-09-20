'use server';

import { type SignOutFailure, signOutUser } from '@/modules/auth';

import { clearOrderView } from '../../(shop)/checkout/order-view';
import { clearCurrentOrgId } from './current-org';

/** `auth` не знае за shop и org cookie-тата (ARC-2) — обвивката е тук, в app-слоя. */
export async function signOutAndClear(): Promise<SignOutFailure> {
  try {
    await clearCurrentOrgId();
    await clearOrderView();
  } catch (error) {
    console.error(
      'signOutAndClear:',
      error instanceof Error ? error.name : 'error',
    );
  }
  return signOutUser();
}
