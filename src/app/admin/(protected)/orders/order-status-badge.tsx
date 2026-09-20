import { Badge, type BadgeTone } from '@/components/ui/badge';
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@/modules/shop';

const TONES: Readonly<Record<OrderStatus, BadgeTone>> = {
  new: 'info',
  cod: 'info',
  paid: 'success',
  in_production: 'warning',
  shipped: 'brand',
  delivered: 'success',
  cancelled: 'danger',
};

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cod: 'наложен платеж',
  card: 'карта',
};

export const PAYMENT_STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
  pending: 'чака',
  paid: 'платено',
  refunded: 'върнато',
};

export function OrderStatusBadge({
  status,
}: Readonly<{ status: OrderStatus }>) {
  return <Badge tone={TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
