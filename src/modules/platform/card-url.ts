// Единственото място, което строи адреса върху картата. Основата е
// `CARD_URL_BASE` или `APP_URL` — никога `Host` (ARC-7).

export function cardUrl(base: string, id: string): string {
  return `${base.endsWith('/') ? base.slice(0, -1) : base}/c/${id}`;
}
