/** Ключ `logos|photos|products/<uuid>.webp` се сервира от `/api/uploads/[kind]/[key]`. */
export function uploadUrl(key: string): string {
  return `/api/uploads/${key}`;
}
