import { redirect } from 'next/navigation';

import { type Admin, getCurrentAdmin } from '@/modules/auth';

/**
 * Пазачът на админа: всяка страница и action го вика сама — layout-ът не се
 * изпълнява при мека навигация (AUTH-7). Без админ → `/admin/login`.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (admin === null) redirect('/admin/login');
  return admin;
}
