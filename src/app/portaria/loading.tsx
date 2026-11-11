/** Aparece na hora ao abrir a portaria, enquanto os dados carregam. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-xl animate-pulse px-4 py-8">
      <div className="mb-6 h-8 w-48 rounded-lg bg-linha" />
      <div className="aspect-square w-full rounded-2xl bg-carvao" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
