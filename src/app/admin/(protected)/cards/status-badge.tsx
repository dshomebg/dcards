import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { CardStatus } from '@/modules/platform';

const TONES: Readonly<Record<CardStatus, BadgeTone>> = {
  blank: 'neutral',
  written: 'info',
  assigned: 'warning',
  active: 'success',
  disabled: 'danger',
};

export const STATUS_LABELS: Readonly<Record<CardStatus, string>> = {
  blank: 'празна',
  written: 'записана',
  assigned: 'разпределена',
  active: 'активна',
  disabled: 'деактивирана',
};

export function CardStatusBadge({ status }: Readonly<{ status: CardStatus }>) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
