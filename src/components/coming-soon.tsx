/** Екран „предстои" — едно място за заглушките в админа и в `/app`. */
export function ComingSoon({ title }: Readonly<{ title: string }>) {
  return (
    <main className="flex flex-col gap-2 px-6 py-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-text-muted text-sm">
        Този екран предстои — съдържанието му идва в следващ цикъл.
      </p>
    </main>
  );
}
