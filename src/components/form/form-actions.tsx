'use client';

import { Button } from '@/components/ui/button';

type FormActionsProps = Readonly<{
  submitLabel: string;
  /** Надписът „в ход" — без него човек не знае дали натискането е стигнало. */
  pendingLabel: string;
  pending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  /**
   * Второ записване, което ОСТАВА на екрана.
   *
   * Незадължително: седем форми ползват лентата, а само редакцията на продукт
   * има какво да покаже след запис (изведените цени, каквито са ЗАПИСАНИ).
   */
  apply?: { label: string; onClick: () => void };
  /** Кратка следа след успешен запис — иначе „остана на екрана" изглежда като
   * „не се случи нищо". */
  status?: string;
}>;

export function FormActions({
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
  onCancel,
  apply,
  status,
}: FormActionsProps) {
  return (
    // Без `sticky`: обвивката (`FormLayout`) я държи ПОД превъртаната област,
    // тоест мястото ѝ е отделено, а не взето назаем от съдържанието.
    <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface py-4">
      <Button onClick={onSubmit} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>

      {apply !== undefined && (
        <Button variant="secondary" onClick={apply.onClick} disabled={pending}>
          {apply.label}
        </Button>
      )}

      <Button variant="secondary" onClick={onCancel} disabled={pending}>
        Отказ
      </Button>

      {status !== undefined && (
        <p role="status" className="text-text-muted text-xs">
          {status}
        </p>
      )}
    </div>
  );
}
