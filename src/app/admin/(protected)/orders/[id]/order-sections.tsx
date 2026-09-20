// Четивните блокове на детайла — сървърни, без състояние.

import type { ReactNode } from 'react';

import { uploadUrl } from '@/lib/upload-url';
import {
  type AdminOrderDto,
  COURIER_LABELS,
  formatPrice,
  type PriceFormat,
} from '@/modules/shop';

import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../order-status-badge';

export function Section({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-card) border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-hint sm:flex-row sm:gap-4">
      <dt className="text-text-muted w-32 shrink-0 text-sm">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function CustomerSection({ order }: Readonly<{ order: AdminOrderDto }>) {
  const { customer } = order;
  return (
    <Section title="Клиент">
      <dl className="flex flex-col gap-2">
        <Row label="Име">{customer.name || '—'}</Row>
        <Row label="Телефон">{customer.phone || '—'}</Row>
        <Row label="Имейл">{customer.email || '—'}</Row>
        <Row label="Акаунт">{order.hasAccount ? 'да' : 'гост'}</Row>
      </dl>
    </Section>
  );
}

export function ShippingSection({ order }: Readonly<{ order: AdminOrderDto }>) {
  const { shipping } = order;
  return (
    <Section title="Доставка">
      <dl className="flex flex-col gap-2">
        <Row label="Куриер">{COURIER_LABELS[shipping.courier]}</Row>
        {shipping.address !== null && (
          <Row label="Адрес">{shipping.address}</Row>
        )}
        {shipping.office !== null && <Row label="Офис">{shipping.office}</Row>}
        {shipping.note !== null && (
          <Row label="Бележка">
            <span className="whitespace-pre-line">{shipping.note}</span>
          </Row>
        )}
        <Row label="Плащане">
          {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{' '}
          {PAYMENT_STATUS_LABELS[order.paymentStatus]}
        </Row>
      </dl>
    </Section>
  );
}

/** `download` с име по uuid — печатницата получава файл, не страница. */
function LogoRow({ logoKey }: Readonly<{ logoKey: string }>) {
  const href = uploadUrl(logoKey);
  return (
    <span className="mt-1 flex items-center gap-hint">
      <img
        src={href}
        alt="Лого"
        width={48}
        height={48}
        className="h-12 w-12 rounded-(--radius-control) border border-border bg-surface object-contain"
      />
      <a href={href} download className="text-brand underline">
        Свали
      </a>
    </span>
  );
}

export function ItemsSection({
  order,
  format,
}: Readonly<{ order: AdminOrderDto; format: PriceFormat }>) {
  return (
    <Section title="Редове">
      <ul className="flex flex-col gap-hint">
        {order.items.map((item, index) => (
          <li
            key={index}
            className="flex justify-between gap-4 border-b border-border pb-2 text-sm last:border-0"
          >
            <span>
              <span className="font-semibold">{item.productName}</span>
              {item.variantName !== '' && (
                <span className="text-text-muted"> · {item.variantName}</span>
              )}
              <span className="text-text-muted block">
                {item.personalization.name}
                {item.personalization.title !== null &&
                  `, ${item.personalization.title}`}
                {item.personalization.notes !== null &&
                  ` — ${item.personalization.notes}`}
              </span>
              {item.personalization.logoKey !== null && (
                <LogoRow logoKey={item.personalization.logoKey} />
              )}
            </span>
            <span className="whitespace-nowrap">
              {item.quantity} × {formatPrice(item.unitPrice, format)} ={' '}
              <strong>{formatPrice(item.lineTotal, format)}</strong>
            </span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col items-end gap-hint border-t border-border pt-3 text-sm">
        <div className="flex gap-4">
          <dt>Продукти</dt>
          <dd>{formatPrice(order.subtotal, format)}</dd>
        </div>
        <div className="flex gap-4">
          <dt>Доставка</dt>
          <dd>{formatPrice(order.shippingCost, format)}</dd>
        </div>
        <div className="flex gap-4 text-base font-semibold">
          <dt>Общо</dt>
          <dd>{formatPrice(order.total, format)}</dd>
        </div>
      </dl>
    </Section>
  );
}
