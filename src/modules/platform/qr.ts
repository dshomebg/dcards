// QR към адреса на профила — само SVG (мащабира се, `<img>` го показва навсякъде).
// Цветовете са подразбираните на библиотеката; PNG е ред в `open-items.md`.

import { toString as qrToString } from 'qrcode';

export function renderQrSvg(url: string): Promise<string> {
  return qrToString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
}
