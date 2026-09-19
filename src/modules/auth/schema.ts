import { z } from 'zod';

/** Една схема за формата и за action-а — двете страни не могат да се разминат. */
export const signInSchema = z.object({
  email: z.email('Въведи валиден имейл.'),
  password: z.string().min(1, 'Въведи парола.').max(256),
});

export type SignInInput = z.infer<typeof signInSchema>;

export interface Admin {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}
