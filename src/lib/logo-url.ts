/** Ключът `logos/<uuid>.webp` се сервира от `/api/uploads/logos/[key]`. */
export function logoUrl(key: string): string {
  return `/api/uploads/${key}`;
}
