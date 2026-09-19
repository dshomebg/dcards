import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { cardStyles } from '../ui/surface';

export type SortDir = 'asc' | 'desc';

/**
 * Сортируемо заглавие (`ORD-38`). Стойността е в АДРЕСА, не тук: таблицата
 * само казва „щракнато е" и рисува стрелката по подаденото.
 */
export interface ColumnSort {
  readonly active: boolean;
  readonly dir: SortDir;
  readonly onToggle: () => void;
}

export interface Column<T> {
  readonly key: string;
  /** Възел, не низ: заглавието на колоната с отметките е самата отметка. */
  readonly header: ReactNode;
  /**
   * Номерът на реда СЪЩО се подава: пореден номер, който продължава през
   * страниците, не се смята от данните (`CAT-50` § 3.1). Колоните, които не го
   * искат, просто не го обявяват.
   */
  readonly cell: (row: T, index: number) => ReactNode;
  readonly className?: string;
  /**
   * Контрола за филтриране ПОД заглавието (`CAT-50` § 3.1).
   *
   * Стои в самата колона, а не в отделна лента: така полето е точно над
   * стойностите, които стеснява, и не може да се размине с тях при разместване.
   */
  readonly filter?: ReactNode;
  /** Без него заглавието е текст, както досега. */
  readonly sort?: ColumnSort;
}

function SortIcon({ sort }: Readonly<{ sort: ColumnSort }>) {
  if (!sort.active) {
    return <ArrowUpDown aria-hidden size={14} className="text-text-muted" />;
  }
  return sort.dir === 'asc' ? (
    <ArrowUp aria-hidden size={14} />
  ) : (
    <ArrowDown aria-hidden size={14} />
  );
}

/** Бутон, не `onClick` на `<th>`: второто е недостижимо с клавиатура. */
function SortableHeader({
  sort,
  children,
}: Readonly<{ sort: ColumnSort; children: ReactNode }>) {
  return (
    <button
      type="button"
      onClick={sort.onToggle}
      className="inline-flex items-center gap-1 rounded-xs hover:underline focus-visible:outline-2 focus-visible:outline-brand"
    >
      {children}
      <SortIcon sort={sort} />
    </button>
  );
}

function ariaSort(sort: ColumnSort | undefined) {
  if (sort === undefined || !sort.active) return undefined;
  return sort.dir === 'asc' ? 'ascending' : 'descending';
}

type DataTableProps<T> = Readonly<{
  /** Чете се от екранния четец вместо „таблица с 25 реда". */
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
}>;

/**
 * Таблица със сървърни данни. Без библиотека нарочно — виж `docs/decisions.md`.
 *
 * Кликаем ред се прави с връзка в клетка (`cell` връща `<Link>`), а не с
 * `onClick` на `<tr>`: второто е недостижимо с клавиатура.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
}: DataTableProps<T>) {
  // Вторият ред се появява само при поне един филтър — иначе всяка таблица без
  // филтри би получила празна лента под заглавията.
  const filtered = columns.some((column) => column.filter !== undefined);

  return (
    <div className={cardStyles('overflow-x-auto')}>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>

        <thead className="border-b border-border bg-surface-muted text-left">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSort(column.sort)}
                className={cn('px-4 py-2.5 font-medium', column.className)}
              >
                {column.sort === undefined ? (
                  column.header
                ) : (
                  <SortableHeader sort={column.sort}>
                    {column.header}
                  </SortableHeader>
                )}
              </th>
            ))}
          </tr>

          {filtered && (
            <tr>
              {/* `td`, не `th`: клетката носи контрола, а не име на колона —
                  екранният четец инак чете полето като заглавие. */}
              {columns.map((column) => (
                <td key={column.key} className="px-4 pb-2.5 align-top">
                  {column.filter}
                </td>
              ))}
            </tr>
          )}
        </thead>

        <tbody>
          {rows.map((row, index) => (
            // Подсветката при посочване е за СКАНИРАНЕ: при широка таблица окото
            // губи реда между първата и последната колона.
            <tr
              key={rowKey(row)}
              className="border-b border-border transition-colors last:border-0 hover:bg-surface-muted"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn('px-4 py-2.5', column.className)}
                >
                  {column.cell(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
