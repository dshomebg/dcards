import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { CardStatus } from '@/modules/platform';

// Думите са за собственика, не за админа: `written` за него е „чака активация".
const TONES: Readonly<Record<CardStatus, BadgeTone>> = {
  blank: 'neutral',
  written: 'info',
  assigned: 'warning',
  active: 'success',
  disabled: 'danger',
};

const LABELS: Readonly<Record<CardStatus, string>> = {
  blank: 'празна',
  written: 'неактивирана',
  assigned: 'без профил',
  active: 'активна',
  disabled: 'деактивирана',
};

export function CardStatusBadge({ status }: Readonly<{ status: CardStatus }>) {
  return <Badge tone={TONES[status]}>{LABELS[status]}</Badge>;
}
