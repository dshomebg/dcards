import type { Admin } from './schema';
import { readSession } from './session';

/** Влезлият админ или `null` — включително при недостъпен Redis. */
export function getCurrentAdmin(): Promise<Admin | null> {
  return readSession();
}
