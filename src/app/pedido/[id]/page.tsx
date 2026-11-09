import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/Cabecalho";
import { pedidoCompleto } from "@/lib/pedidos";
import { configCasa } from "@/lib/config";
import { modoDemo } from "@/lib/env";
import { brl, dataLonga, hora, SETORES } from "@/lib/format";
import { Pagamento } from "./Pagamento";
import { RastreioCompra } from "./RastreioCompra";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seu pedido", robots: { index: false } };

export default async function PaginaPedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await pedidoCompleto(id);
  if (!p) notFound();
  const casa = await configCasa();
  const expirado = p.status === "expirado" || (p.status === "pendente" && new Date(p.expira_em) < new Date());

  return (
    <>
      <Cabecalho />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="surge mb-8 text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.45em] text-ouro">Pedido {p.codigo}</p>
          <h1 className="mt-3 font-display text-4xl text-marfim sm:text-5xl">{p.festa.titulo}</h1>
          <p className="mt-2 text-sm text-fumaca">{dataLonga(p.festa.data_inicio)} · {hora(p.festa.data_inicio)}</p>
        </div>

        <div className="cartao surge mb-6 space-y-2 p-5" style={{ animationDelay: ".1s" }}>
          {p.itens.map((i: any) => (
            <div key={i.id} className="flex justify-between text-sm">
              <span className="text-fumaca">{i.quantidade}× {SETORES[i.lote.setor] || i.lote.setor} · {i.lote.nome}</span>
              <span>{brl(i.quantidade * i.preco_unit_centavos)}</span>
            </div>
          ))}
          {p.desconto_centavos > 0 && (
            <div className="flex justify-between text-sm text-sucesso"><span>Cupom {p.cupom?.codigo}</span><span>− {brl(p.desconto_centavos)}</span></div>
          )}
          <div className="linha-ouro !my-3 opacity-40" />
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-[0.25em] text-fumaca">Total</span>
            <span className="texto-ouro font-display text-3xl font-semibold">{brl(p.total_centavos)}</span>
          </div>
        </div>

        {p.status === "pago" ? (
          <section className="surge space-y-6 text-center">
            <RastreioCompra valor={p.total_centavos / 100} />
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full ouro-gradiente text-4xl text-noir">✓</div>
            <div>
              <h2 className="font-display text-4xl text-marfim">Pagamento aprovado!</h2>
              <p className="mt-2 text-sm text-fumaca">Enviamos os ingressos para <b className="text-marfim">{p.cliente?.email}</b> e para o seu WhatsApp.</p>
            </div>
            <div className="grid gap-3 text-left">
              {p.ingressos.map((t: any) => (
                <Link key={t.id} href={`/ingresso/${t.codigo}`} className="cartao flex items-center justify-between p-4 transition hover:border-ouro/60">
                  <div>
                    <p className="font-display text-xl text-marfim">{t.nome_titular}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-fumaca">{SETORES[t.lote?.setor] || t.lote?.setor} · {t.lote?.nome}</p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.25em] text-ouro">Ver QR →</span>
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {casa.whatsapp_casa && (
                <a className="btn-ouro ouro-gradiente" target="_blank" rel="noreferrer"
                   href={`https://wa.me/${casa.whatsapp_casa}?text=${encodeURIComponent(`Oi GLAM! Garanti meu ingresso para ${p.festa.titulo} ✨ Pedido ${p.codigo}`)}`}>
                  Avisar a GLAM no WhatsApp
                </a>
              )}
              <Link href="/meus-ingressos" className="btn-linha">Meus ingressos</Link>
            </div>
          </section>
        ) : expirado ? (
          <section className="cartao p-8 text-center">
            <h2 className="font-display text-3xl">O tempo de reserva acabou</h2>
            <p className="mt-2 text-sm text-fumaca">As vagas voltaram para a venda. Faça um novo pedido para garantir o seu.</p>
            <Link href={`/festa/${p.festa.slug}`} className="btn-ouro ouro-gradiente mt-6">Comprar de novo</Link>
          </section>
        ) : p.status === "pendente" ? (
          <Pagamento pedidoId={p.id} expiraEm={p.expira_em} demo={modoDemo()} nomeCliente={p.cliente?.nome || ""} />
        ) : (
          <section className="cartao p-8 text-center">
            <h2 className="font-display text-3xl">Pedido {p.status}</h2>
            <p className="mt-2 text-sm text-fumaca">Fale com a GLAM se precisar de ajuda.</p>
          </section>
        )}
      </main>
    </>
  );
}
