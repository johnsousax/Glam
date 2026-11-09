import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { PromoterRef } from "@/components/PromoterRef";
import { festaPorSlug, percentualVendido, setoresDaFesta } from "@/lib/festas";
import { configCasa } from "@/lib/config";
import { dataLonga, hora } from "@/lib/format";
import { Checkout } from "./Checkout";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = await festaPorSlug(slug).catch(() => null);
  if (!f) return {};
  return { title: f.titulo, description: f.subtitulo || f.descricao || undefined, openGraph: { images: f.cartaz_url ? [f.cartaz_url] : [] } };
}

export default async function PaginaFesta({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const festa = await festaPorSlug(slug);
  if (!festa || festa.status === "rascunho") notFound();
  const [setores, casa, percentual] = await Promise.all([
    setoresDaFesta(festa.id),
    configCasa(),
    festa.mostrar_percentual ? percentualVendido(festa) : Promise.resolve(null),
  ]);
  const aberta = festa.status === "publicada" && +new Date(festa.data_fim || festa.data_inicio) + 6 * 3600e3 > Date.now();

  return (
    <>
      <PromoterRef />
      <Cabecalho />
      <main className="relative z-10 mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* Cartaz e informações */}
          <div className="surge lg:sticky lg:top-24 lg:self-start">
            <div className="cartao overflow-hidden">
              {festa.cartaz_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={festa.cartaz_url} alt={festa.titulo} className="aspect-[4/5] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-grafite p-8 text-center">
                  <span className="font-display text-5xl italic texto-ouro">{festa.titulo}</span>
                </div>
              )}
            </div>
          </div>

          <div className="surge space-y-8" style={{ animationDelay: ".1s" }}>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.45em] text-fumaca">{dataLonga(festa.data_inicio)} · {hora(festa.data_inicio)}</p>
              <h1 className="mt-3 font-display text-5xl leading-[1.02] text-marfim sm:text-6xl">{festa.titulo}</h1>
              {festa.subtitulo && <p className="mt-3 text-lg text-fumaca">{festa.subtitulo}</p>}
              <div className="mt-6 flex flex-wrap gap-2 text-[0.7rem] uppercase tracking-[0.2em]">
                <span className="rounded-full border border-linha px-3 py-1.5 text-fumaca">📍 {festa.local_nome || "GLAM House"}</span>
                {festa.classificacao && <span className="rounded-full border border-linha px-3 py-1.5 text-fumaca">{festa.classificacao}</span>}
                {festa.status === "cancelada" && <span className="rounded-full bg-perigo px-3 py-1.5 text-noir">Cancelada</span>}
              </div>
              {festa.endereco && <p className="mt-3 text-sm text-fumaca">{festa.endereco}</p>}
              {percentual != null && (
                <div className="mt-6 max-w-sm">
                  <div className="h-1.5 overflow-hidden rounded-full bg-linha"><div className="ouro-gradiente brilho-ouro h-full" style={{ width: `${percentual}%` }} /></div>
                  <p className="mt-2 text-[0.65rem] uppercase tracking-[0.25em] text-fumaca">{percentual}% dos ingressos vendidos</p>
                </div>
              )}
              {festa.descricao && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-marfim/80">{festa.descricao}</p>}
            </div>

            {aberta ? (
              <Checkout festaId={festa.id} festaTitulo={festa.titulo} setores={setores} />
            ) : (
              <div className="cartao p-8 text-center">
                <p className="font-display text-2xl italic">Vendas encerradas para esta festa.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Rodape whatsapp={casa.whatsapp_casa} instagram={casa.instagram} />
    </>
  );
}
