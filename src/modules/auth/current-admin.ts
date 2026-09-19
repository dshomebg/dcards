import { loadCurrentRow } from './current-user';
import type { Admin } from './schema';

/**
 * Влезлият админ или `null`. Ролята се решава от реда при всяка заявка
 * (AUTH-5). Не-админ НЕ губи сесията си — тя е една и за `/app` (AUTH-7);
 * само липсващ ред я отменя (в `loadCurrentRow`).
 */
export async function getCurrentAdmin(): Promise<Admin | null> {
  const current = await loadCurrentRow();
  if (current === null || !current.user.isAdmin) return null;
  return current.session;
}
