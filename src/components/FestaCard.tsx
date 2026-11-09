import Link from "next/link";
import { brl, diaMes, hora } from "@/lib/format";
import type { Festa } from "@/lib/tipos";

export function FestaCard({ festa, aPartir, esgotada, percentual, indice = 0 }: { festa: Festa; aPartir: number | null; esgotada: boolean; percentual: number | null; indice?: number }) {
  const d = diaMes(festa.data_inicio);
  return (
    <Link href={`/festa/${festa.slug}`} className="surge group block" style={{ animationDelay: `${indice * 0.08}s` }}>
      <article className="cartao relative overflow-hidden transition duration-500 group-hover:-translate-y-1 group-hover:border-marfim/20">
        <div className="relative aspect-[4/5] overflow-hidden">
          {festa.cartaz_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={festa.cartaz_url} alt={festa.titulo} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-grafite">
              <span className="font-display text-5xl italic texto-ouro">{festa.titulo}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-noir via-noir/10 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-col items-center rounded-2xl border border-linha bg-noir/70 px-3 py-2 backdrop-blur">
            <span className="text-[0.6rem] tracking-[0.25em] text-fumaca">{d.semana}</span>
            <span className="font-display text-3xl leading-none text-marfim">{d.dia}</span>
            <span className="text-[0.6rem] tracking-[0.25em] text-fumaca">{d.mes}</span>
          </div>
          {esgotada && (
            <span className="absolute right-4 top-4 rounded-full bg-perigo/90 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-noir">Esgotado</span>
          )}
        </div>
        <div className="relative -mt-16 space-y-3 p-5">
          <h3 className="font-display text-3xl leading-tight text-marfim">{festa.titulo}</h3>
          {festa.subtitulo && <p className="text-sm text-fumaca">{festa.subtitulo}</p>}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs uppercase tracking-[0.2em] text-fumaca">{hora(festa.data_inicio)} · {festa.local_nome || "GLAM"}</span>
            {aPartir != null && <span className="text-sm"><span className="text-fumaca">a partir de </span><span className="texto-ouro font-semibold">{brl(aPartir)}</span></span>}
          </div>
          {percentual != null && (
            <div className="pt-1">
              <div className="h-1 overflow-hidden rounded-full bg-linha"><div className="ouro-gradiente h-full" style={{ width: `${percentual}%` }} /></div>
              <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-fumaca">{percentual}% vendido</p>
            </div>
          )}
          <div className="linha-ouro !mt-4 opacity-40" />
          <p className="text-center text-[0.7rem] uppercase tracking-[0.35em] text-fumaca transition group-hover:tracking-[0.45em]">Comprar ingresso →</p>
        </div>
      </article>
    </Link>
  );
}
