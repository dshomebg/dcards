import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ setOrgPlanAction: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('./actions', () => actions);
// Barrel-ът на `platform` дърпа `core` (env, Redis) — формата иска само надписите.
vi.mock('@/modules/core', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const { PlanForm } = await import('./plan-form');

const ORG_ID = '019969a0-0000-7000-8000-000000000002';

describe('PlanForm', () => {
  beforeEach(() => {
    actions.setOrgPlanAction.mockReset();
    router.refresh.mockClear();
  });

  it('disables the date for free and enables it for pro', () => {
    render(<PlanForm orgId={ORG_ID} plan="free" expiresOn="" />);
    const date = screen.getByLabelText<HTMLInputElement>('Изтича на');
    expect(date.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('План'), {
      target: { value: 'pro' },
    });
    expect(date.disabled).toBe(false);
  });

  it('sends org, plan and date; refreshes on success', async () => {
    actions.setOrgPlanAction.mockResolvedValue({ ok: true });
    render(<PlanForm orgId={ORG_ID} plan="pro" expiresOn="2026-12-31" />);

    fireEvent.change(screen.getByLabelText('Изтича на'), {
      target: { value: '2027-01-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Запиши плана' }));

    await waitFor(() =>
      expect(actions.setOrgPlanAction).toHaveBeenCalledWith(
        ORG_ID,
        'pro',
        '2027-01-15',
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Записано.'),
    );
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows the action message on failure without refreshing', async () => {
    actions.setOrgPlanAction.mockResolvedValue({
      ok: false,
      message: 'Датата е минала — избери днес или по-късно.',
    });
    render(<PlanForm orgId={ORG_ID} plan="pro" expiresOn="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Запиши плана' }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'Датата е минала — избери днес или по-късно.',
      ),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
