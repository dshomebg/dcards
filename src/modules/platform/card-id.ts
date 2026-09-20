// Публичните идентификатори на картата (DAT-3): чисти функции, без база.
// Веднъж отпечатани върху чип и CSV, те са вечни — форматът тук не се сменя.

import { randomBytes, randomInt } from 'node:crypto';

import { z } from 'zod';

/** Без 0/O/1/I — картата се набира и на ръка. 32 знака: един байт `& 31` е равномерен. */
export const CARD_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 32⁸ ≈ 1.1·10¹² — сляпото отгатване е безнадеждно и при стотици хиляди карти. */
export const CARD_ID_LENGTH = 8;

/** 6–8: по-къси id са допустими в базата за ръчно издадени карти, не се генерират. */
export const CARD_ID_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,8}$/;

export const ACTIVATION_CODE_PATTERN = /^\d{6}$/;

/** Инжектира се в `createBatch` — db тестът симулира сблъсък без мок на `crypto`. */
export interface CardGenerator {
  cardId(): string;
  activationCode(): string;
}

export function generateCardId(): string {
  let id = '';
  for (const byte of randomBytes(CARD_ID_LENGTH)) {
    id += CARD_ID_ALPHABET[byte & 31];
  }
  return id;
}

/** Кодът е с водещите нули — „000123" е валиден и трябва да се печата така. */
export function generateActivationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export const defaultCardGenerator: CardGenerator = {
  cardId: generateCardId,
  activationCode: generateActivationCode,
};

/** Точно търсене по id: малки букви се приемат, всичко друго е отказ без заявка. */
export const cardIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    CARD_ID_PATTERN,
    'Номерът на картата е 6–8 знака — букви и цифри, без 0, O, 1 и I.',
  );
