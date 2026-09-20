// Пробен DTO за тестовете на редактора — един за всички файлове.

import type { ProductEditDto } from '@/modules/shop';

export const PRODUCT_ID = '019969a0-0000-7000-8000-0000000000aa';

export function testProduct(
  overrides: Partial<ProductEditDto> = {},
): ProductEditDto {
  return {
    id: PRODUCT_ID,
    slug: 'pvc-classic',
    name: 'PVC Classic',
    description: 'Класика.',
    material: 'pvc',
    basePrice: 1990,
    isActive: true,
    updatedAt: new Date('2026-09-20T00:00:00Z'),
    variants: [
      {
        id: '019969a0-0000-7000-8000-0000000000b1',
        name: 'Бяла',
        priceDelta: 0,
        sku: 'PVC-B',
        stock: 10,
        isActive: true,
        sortOrder: 0,
      },
      {
        id: '019969a0-0000-7000-8000-0000000000b2',
        name: 'Черна',
        priceDelta: 250,
        sku: null,
        stock: 5,
        isActive: false,
        sortOrder: 1,
      },
    ],
    ...overrides,
  };
}
