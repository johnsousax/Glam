import { Cabecalho } from "./Cabecalho";
import { Rodape } from "./Rodape";

export function PaginaTexto({ titulo, versao, children }: { titulo: string; versao: string; children: React.ReactNode }) {
  return (
    <>
      <Cabecalho />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-[0.65rem] uppercase tracking-[0.4em] text-ouro">GLAM House</p>
        <h1 className="mt-2 font-display text-5xl">{titulo}</h1>
        <p className="mt-2 text-xs text-fumaca">Versão {versao}</p>
        <div className="prosa mt-8 space-y-5 text-sm leading-relaxed text-marfim/85 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-marfim [&_li]:ml-5 [&_li]:list-disc">{children}</div>
      </main>
      <Rodape />
    </>
  );
}
