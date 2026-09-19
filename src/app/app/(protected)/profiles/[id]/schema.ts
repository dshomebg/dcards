import { z } from 'zod';

import {
  type ProfileEditDto,
  profileLinkInputSchema,
  type ProfileTheme,
  slugSchema,
  updateProfileInputSchema,
} from '@/modules/platform';

// Формата държи низове, не `null`: празното поле е `''` и action-ът го обръща.
// Границите са тези на сервиза; тук само се слагат български съобщения.
const TOO_LONG = 'Твърде дълго.';
const optional = (max: number) => z.string().trim().max(max, TOO_LONG);

export const profileLinkFormSchema = profileLinkInputSchema.extend({
  label: optional(60),
  value: z.string().trim().min(1, 'Въведи стойност.').max(500, TOO_LONG),
  isVisible: z.boolean(),
});

export const profileFormSchema = updateProfileInputSchema.extend({
  slug: slugSchema,
  firstName: z.string().trim().min(1, 'Въведи име.').max(80, TOO_LONG),
  lastName: z.string().trim().min(1, 'Въведи фамилия.').max(80, TOO_LONG),
  title: optional(120),
  company: optional(120),
  bio: optional(600),
  links: z.array(profileLinkFormSchema).max(50, 'До 50 линка.'),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
export type ProfileLinkFormValues = z.infer<typeof profileLinkFormSchema>;

export const THEME_OPTIONS: readonly {
  readonly value: ProfileTheme['preset'];
  readonly label: string;
}[] = [
  { value: 'light', label: 'Светла' },
  { value: 'dark', label: 'Тъмна' },
  { value: 'sand', label: 'Пясък' },
];

/** `null` → `''`: полетата държат низове; action-ът връща обратно към `null`. */
export function toFormValues(profile: ProfileEditDto): ProfileFormValues {
  return {
    slug: profile.slug,
    firstName: profile.firstName,
    lastName: profile.lastName,
    title: profile.title ?? '',
    company: profile.company ?? '',
    bio: profile.bio ?? '',
    theme: profile.theme,
    isPublic: profile.isPublic,
    links: profile.links.map((link) => ({
      type: link.type,
      label: link.label ?? '',
      value: link.value,
      isVisible: link.isVisible,
    })),
  };
}
