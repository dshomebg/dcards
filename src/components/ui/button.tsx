import type { ButtonHTMLAttributes, Ref } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    /**
     * В React 19 `ref` е обикновен проп и `{...props}` го предава сам — тук се
     * обявява само за типа. Ползва се, за да върне фокуса извикалият прозорец.
     */
    ref?: Ref<HTMLButtonElement>;
  }
>;

/**
 * Височината е ЕДНА — `h-control`, колкото полето и списъка. Изключение е
 * `ghost`: вградено действие в ред, мери се по съдържанието си — иначе всеки
 * ред в таблица пораства заради едно „Архивирай".
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'h-control bg-brand text-brand-contrast hover:bg-brand-hover',
  secondary: 'h-control border border-border bg-surface hover:bg-surface-muted',
  ghost: 'hover:bg-surface-muted',
  danger: 'h-control bg-danger text-danger-contrast hover:bg-danger-hover',
};

const BASE =
  'inline-flex items-center justify-center gap-hint rounded-(--radius-control) ' +
  'px-4 py-2 text-sm font-medium transition-colors ' +
  'disabled:pointer-events-none disabled:opacity-50';

/**
 * Същият вид, но за `<Link>`: „Нов продукт" е връзка, не бутон. Изнесена е
 * само рецептата за класове — иначе всеки екран я преписва и копията се
 * разминават.
 */
export function buttonStyles(
  variant: Variant = 'primary',
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], className);
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      // Изричен `type`: по подразбиране бутон във форма е `submit`, което
      // праща формата при всяко натискане на бутон, който не е трябвало да я
      // праща. Тук подразбирането е обърнато на безопасното.
      type={type}
      className={buttonStyles(variant, className)}
      {...props}
    />
  );
}
