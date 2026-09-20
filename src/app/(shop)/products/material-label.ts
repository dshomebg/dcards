import type { ProductMaterial } from '@/modules/shop';

// Витрината има своя карта на надписите — админът не се внася в публичното.
export const MATERIAL_LABELS: Readonly<Record<ProductMaterial, string>> = {
  pvc: 'PVC',
  metal: 'Метал',
  wood: 'Дърво',
};
