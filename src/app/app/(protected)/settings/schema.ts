import { z } from 'zod';

import { changePasswordInputSchema } from '@/modules/auth';

// Повторението е само за формата — сервизът вижда двете полета от `auth`.
export const changePasswordFormSchema = changePasswordInputSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Паролите не съвпадат.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Новата парола трябва да е различна от текущата.',
    path: ['newPassword'],
  });

export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
