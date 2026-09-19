export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Няма такава страница
      </h1>
      <p className="text-text-muted">
        Адресът е грешен или профилът вече не е публичен.
      </p>
      <a href="/" className="text-brand underline">
        Към началото
      </a>
    </main>
  );
}
