// Пробен DTO за dom тестовете на редактора — един за трите файла.

import type { ProfileEditDto } from '@/modules/platform';

export function testProfile(
  overrides: Partial<ProfileEditDto> = {},
): ProfileEditDto {
  return {
    id: '019969a0-0000-7000-8000-0000000000aa',
    slug: 'ivan-petrov',
    firstName: 'Иван',
    lastName: 'Петров',
    title: 'Управител',
    company: 'Демо ООД',
    bio: 'Здравей.',
    theme: { preset: 'sand', primaryColor: null, layout: 'default' },
    isPublic: true,
    updatedAt: new Date('2026-09-19T00:00:00Z'),
    links: [
      {
        id: 'l1',
        type: 'phone',
        label: null,
        value: '+359881234567',
        isVisible: true,
        sortOrder: 0,
      },
      {
        id: 'l2',
        type: 'email',
        label: 'Пиши ми',
        value: 'ivan@demo.bg',
        isVisible: false,
        sortOrder: 1,
      },
      {
        id: 'l3',
        type: 'website',
        label: null,
        value: 'demo.bg',
        isVisible: true,
        sortOrder: 2,
      },
    ],
    ...overrides,
  };
}
