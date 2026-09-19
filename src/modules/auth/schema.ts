import { z } from 'zod';

/** Една схема за формата и за action-а — двете страни не могат да се разминат. */
export const signInSchema = z.object({
  email: z.email('Въведи валиден имейл.').max(254),
  password: z.string().min(1, 'Въведи парола.').max(256),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Въведи име.').max(120, 'Твърде дълго име.'),
  email: z.email('Въведи валиден имейл.').max(254),
  password: z
    .string()
    .min(8, 'Паролата трябва да е поне 8 знака.')
    .max(256, 'Твърде дълга парола.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Каквото носи сесията — публичното от реда в `users`, без роля (AUTH-7). */
export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

// Админът е същият ред със същата сесия — името остава за админския код.
export type Admin = SessionUser;
