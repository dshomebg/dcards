import type { ReactNode } from 'react';

/**
 * Три колони за формите с много секции (`MKT-17`): на тесен екран една под
 * друга, от `wide` нагоре — една до друга, за да не стоят белите полета.
 */
export function FormColumns({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="grid gap-8 wide:grid-cols-3">{children}</div>;
}

export function FormColumn({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="flex flex-col gap-8">{children}</div>;
}
