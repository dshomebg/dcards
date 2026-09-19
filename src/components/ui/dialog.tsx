'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

import { Button } from './button';

type ConfirmDialogProps = Readonly<{
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  error?: string | null;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}>;

/**
 * Потвърждение върху native `<dialog>` + `showModal()`: задържане на фокуса,
 * Esc и връщане на фокуса идват от браузъра — при `div` се пишат на ръка.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отказ',
  error,
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // `onClose` хваща и Esc, и програмното затваряне — така състоянието на
      // извикващия не се разминава с това на браузъра.
      onClose={onClose}
      className={
        // `whitespace-normal`: отворен от клетка с `nowrap`, диалогът иначе
        // наследява реда и реже описанието си (`CAT-83`).
        'm-auto w-full max-w-md rounded-(--radius-card) border border-border ' +
        'bg-surface p-0 text-left text-text whitespace-normal backdrop:bg-overlay/50'
      }
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">{title}</h2>

        {description !== undefined && (
          <div className="text-text-muted text-sm">{description}</div>
        )}

        {error != null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>

          {/* Надписът назовава действието: човек по инерция чете последния
              бутон, а „Да" не казва на какво. */}
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

type FormDialogProps = Readonly<{
  open: boolean;
  title: string;
  description?: ReactNode;
  /**
   * Тече ли недовършено действие — качване или запис. Докато е `true`,
   * прозорецът НЕ се затваря сам: нито с Esc, нито с щракане встрани.
   */
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}>;

/**
 * Свое ли е събитието, или на вложен диалог. `close` и `cancel` НЕ се разпростират
 * в DOM, но React ги подава и на предците — потвърждението вътре инак затваря и
 * прозореца около себе си (видяно на живо).
 */
const ownEvent = (event: {
  target: unknown;
  currentTarget: unknown;
}): boolean => event.target === event.currentTarget;

/**
 * Прозорец с ФОРМА вътре — СЪСЕД на `ConfirmDialog`, не негово разширение:
 * онзи има зашит тон `danger` и един довод да съществува („питай, преди да е
 * късно"), а форма с две качвания в него би направила и двете неверни (§ 3.9).
 */
export function FormDialog({
  open,
  title,
  description,
  busy = false,
  onClose,
  children,
}: FormDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // `showModal()`, не свой `div`: задържането на фокуса, собственият му ред и
  // връщането към бутона, който е отворил прозореца, идват от браузъра.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc е ЗАЯВКА към браузъра, не команда: без отказ тук той затваря сам и
      // въведеното изчезва, без човекът да е натиснал каквото и да е (§ 3.9).
      onCancel={(event) => {
        if (busy && ownEvent(event)) event.preventDefault();
      }}
      onClose={(event) => {
        if (ownEvent(event)) onClose();
      }}
      // Подложката няма свой елемент — щракането по нея има за цел самия
      // `<dialog>`. Всичко вътре е обвито, тоест дотук стигат само тези встрани.
      onClick={(event) => {
        if (ownEvent(event) && !busy) onClose();
      }}
      className={
        'm-auto w-full max-w-3xl rounded-(--radius-card) border border-border ' +
        'bg-surface p-0 text-text backdrop:bg-overlay/50'
      }
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-start gap-3 border-b border-border p-6">
          <div className="flex flex-1 flex-col gap-hint">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description !== undefined && (
              <div className="text-text-muted text-sm">{description}</div>
            )}
          </div>

          <Button
            variant="ghost"
            className="p-1"
            aria-label="Затвори"
            disabled={busy}
            onClick={onClose}
          >
            <X aria-hidden size={18} />
          </Button>
        </div>

        {/* Превърта се СЪДЪРЖАНИЕТО, не целият прозорец: иначе заглавието и
            бутонът за затваряне се изгубват нагоре при дълъг списък. */}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </dialog>
  );
}
