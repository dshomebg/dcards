'use server';

import { type SignOutFailure, signOutUser } from '@/modules/auth';

import { clearOrderView } from '../../(shop)/checkout/order-view';

/** `auth` не знае за shop cookie-то (ARC-2) — обвивката е тук, в app-слоя. */
export async function signOutAndClear(): Promise<SignOutFailure> {
  try {
    await clearOrderView();
  } catch (error) {
    console.error(
      'signOutAndClear:',
      error instanceof Error ? error.name : 'error',
    );
  }
  return signOutUser();
}
