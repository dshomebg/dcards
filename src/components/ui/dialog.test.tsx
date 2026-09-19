import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog, FormDialog } from './dialog';

/**
 * Esc не се НАБИРА: затварянето с него е действие на браузъра, а средата дава
 * само DOM. Браузърът праща точно това събитие и пазачът виси на него.
 */
function pressEscape(dialog: HTMLDialogElement): Event {
  const cancel = new Event('cancel', { cancelable: true });
  fireEvent(dialog, cancel);

  return cancel;
}

function dialogOf(buttonName: string): HTMLDialogElement {
  const button = screen.getByRole('button', { name: buttonName });
  const dialog = button.closest('dialog');
  if (dialog === null) throw new Error(`няма прозорец около „${buttonName}"`);

  return dialog;
}

describe('FormDialog — вложеното потвърждение', () => {
  it('не затваря родителския прозорец', () => {
    const onParentClose = vi.fn();
    const onInnerClose = vi.fn();

    render(
      <FormDialog open title="Редакция на продукт" onClose={onParentClose}>
        <p>форма</p>
        <ConfirmDialog
          open
          title="Изтриване на снимка"
          confirmLabel="Изтрий"
          onConfirm={vi.fn()}
          onClose={onInnerClose}
        />
      </FormDialog>,
    );

    const parent = screen.getByRole('dialog', { name: 'Редакция на продукт' });
    const inner = dialogOf('Изтрий');

    // Точният ред на браузъра при Esc: първо `cancel`, после `close`.
    pressEscape(inner);
    inner.close();

    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onParentClose).not.toHaveBeenCalled();
    expect((parent as HTMLDialogElement).open).toBe(true);
  });
});

describe('FormDialog — заетостта', () => {
  it('не се затваря нито с Esc, нито с щракане встрани', () => {
    const onClose = vi.fn();
    const view = (busy: boolean) => (
      <FormDialog open busy={busy} title="Качване на файл" onClose={onClose}>
        <p>форма</p>
      </FormDialog>
    );

    const { rerender } = render(view(true));
    const dialog = screen.getByRole<HTMLDialogElement>('dialog', {
      name: 'Качване на файл',
    });

    expect(pressEscape(dialog).defaultPrevented).toBe(true);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);

    // Контрола в самия тест: без `busy` двете действия минават, тоест спира ги
    // пазачът, а не средата.
    rerender(view(false));
    expect(pressEscape(dialog).defaultPrevented).toBe(false);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠ Пазачът виси на ТРИ места (`onCancel`, `onClose`, `onClick`), а горните
   * два теста покриват две. Без него щракане по СЪДЪРЖАНИЕТО затваря формата.
   */
  it('щракане ВЪТРЕ във формата не затваря прозореца', () => {
    const onClose = vi.fn();

    render(
      <FormDialog open title="Качване на файл" onClose={onClose}>
        <p>форма</p>
      </FormDialog>,
    );

    fireEvent.click(screen.getByText('форма'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
