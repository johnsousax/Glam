import { Cabecalho } from "./Cabecalho";

/** Tela que aparece na hora do toque, enquanto o servidor busca os dados (navegação instantânea). */
export function EsqueletoPublico({ tipo }: { tipo: "festa" | "pedido" | "simples" }) {
  return (
    <>
      <Cabecalho />
      <main role="status" aria-live="polite" className="relative z-10 mx-auto max-w-6xl animate-pulse px-4 pt-8 sm:px-6 sm:pt-12">
        {tipo === "festa" ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="aspect-[4/5] w-full rounded-2xl bg-carvao" />
            <div className="space-y-5">
              <div className="h-3 w-48 rounded bg-linha" />
              <div className="h-12 w-3/4 rounded-lg bg-linha" />
              <div className="h-8 w-40 rounded-full bg-carvao" />
              <div className="h-40 rounded-2xl bg-carvao" />
              <div className="h-56 rounded-2xl bg-carvao" />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="h-3 w-40 rounded bg-linha" />
            <div className="h-10 w-2/3 rounded-lg bg-linha" />
            <div className={`${tipo === "pedido" ? "h-80" : "h-48"} rounded-2xl bg-carvao`} />
            {tipo === "pedido" && <div className="h-24 rounded-2xl bg-carvao" />}
          </div>
        )}
        <span className="sr-only">Carregando…</span>
      </main>
    </>
  );
}
