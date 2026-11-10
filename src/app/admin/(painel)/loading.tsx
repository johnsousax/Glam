/** Aparece na hora ao trocar de página no painel, enquanto os dados carregam. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <div className="mb-8 h-8 w-56 rounded-lg bg-linha" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-carvao" />)}
      </div>
      <div className="mt-6 h-48 rounded-xl bg-carvao" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
