import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const placeOrderAction = vi.hoisted(() => vi.fn());

vi.mock('./actions', () => ({ placeOrderAction }));

const { CheckoutForm } = await import('./checkout-form');

const view = {
  lines: [
    {
      id: 'l1',
      variantId: 'v1',
      productSlug: 'pvc-classic',
      productName: 'PVC Classic',
      variantName: 'Бяла',
      unitPrice: 1990,
      quantity: 2,
      lineTotal: 3980,
      personalization: {
        name: 'Иван',
        title: null,
        notes: null,
        logoKey: null,
      },
      available: true,
    },
  ],
  subtotal: 3980,
  count: 2,
} as const;

const format = { currency: 'BGN', locale: 'bg-BG' };

function renderForm() {
  return render(
    <CheckoutForm
      view={view}
      format={format}
      shippingCost={590}
      defaultValues={{ name: 'Иван Петров', email: 'ivan@x.bg' }}
    />,
  );
}

function type(label: string, value: string) {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

const submit = () =>
  fireEvent.submit(screen.getByRole('button', { name: 'Поръчай' }));

describe('CheckoutForm', () => {
  beforeEach(() => {
    placeOrderAction.mockReset();
  });

  it('requires an address when delivery is to an address', async () => {
    renderForm();
    type('Телефон', '+359881234567');
    fireEvent.click(screen.getByLabelText('До адрес'));
    submit();

    expect(await screen.findByText('Въведи адрес за доставка.')).toBeTruthy();
    expect(placeOrderAction).not.toHaveBeenCalled();
  });

  it('rejects a bad phone before the action runs', async () => {
    renderForm();
    type('Телефон', 'abc');
    type('Офис на куриера', 'Еконт Център');
    submit();

    expect(await screen.findByText('Въведи валиден телефон.')).toBeTruthy();
    expect(placeOrderAction).not.toHaveBeenCalled();
  });

  it('keeps card payment disabled and cod checked', () => {
    renderForm();
    const card = screen.getByLabelText<HTMLInputElement>(/С карта/);
    const cod = screen.getByLabelText<HTMLInputElement>(/Наложен платеж/);
    expect(card.disabled).toBe(true);
    expect(cod.checked).toBe(true);
  });

  it('sends only customer and shipping fields, never sums', async () => {
    placeOrderAction.mockResolvedValue({
      ok: false,
      message: 'Няма наличност.',
    });
    renderForm();
    type('Телефон', '+359881234567');
    type('Офис на куриера', 'Еконт Център');
    submit();

    await waitFor(() => expect(placeOrderAction).toHaveBeenCalledTimes(1));
    const sent = placeOrderAction.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      name: 'Иван Петров',
      email: 'ivan@x.bg',
      courier: 'econt',
      deliveryKind: 'office',
      office: 'Еконт Център',
      paymentMethod: 'cod',
    });
    expect(Object.keys(sent)).not.toContain('subtotal');
    expect(Object.keys(sent)).not.toContain('total');
    expect(screen.getByRole('alert').textContent).toBe('Няма наличност.');
  });

  it('shows the totals it was given', () => {
    renderForm();
    expect(
      screen.getByText('Доставка', { selector: 'dt' }).nextSibling?.textContent,
    ).toContain('5,90');
    expect(
      screen.getByText('Общо', { selector: 'dt' }).nextSibling?.textContent,
    ).toContain('45,70');
  });
});
