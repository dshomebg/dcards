// Единственото място, което строи адреса на профил. Само от `APP_URL` + slug —
// никога от `Host`/`request.url` (ARC-7), за да не кодира QR-ът подаден хост.

export function profileUrl(appUrl: string, slug: string): string {
  return `${appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl}/${slug}`;
}
