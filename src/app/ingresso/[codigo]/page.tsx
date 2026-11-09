import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Cabecalho } from "@/components/Cabecalho";
import { Logo } from "@/components/Logo";
import { db } from "@/lib/supabase-admin";
import { dataLonga, hora, SETORES, dataHora } from "@/lib/format";
import { Transferir } from "./Transferir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seu ingresso", robots: { index: false } };

export default async function PaginaIngresso({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(codigo)) notFound();
  const { data: t } = await db()
    .from("glam_ingressos")
    .select("*, festa:glam_festas(titulo,data_inicio,local_nome,endereco,cartaz_url,slug), lote:glam_lotes(nome,setor), pedido:glam_pedidos(codigo,status)")
    .eq("codigo", codigo)
    .maybeSingle();
  if (!t) notFound();
  const qr = await QRCode.toDataURL(`GLAM:${t.codigo}`, { width: 600, margin: 1, errorCorrectionLevel: "M" });
  const valido = t.status === "ativo" && t.pedido?.status === "pago";
  const passou = +new Date(t.festa.data_inicio) < Date.now() - 12 * 3600e3;

  return (
    <>
      <Cabecalho />
      <main className="relative z-10 mx-auto max-w-md px-4 py-10">
        <article className="surge relative overflow-hidden rounded-[1.75rem] border border-linha bg-gradient-to-b from-grafite to-carvao">
          <div className="ouro-gradiente h-1" />
          
          <div className="space-y-1 p-6 text-center">
            <Logo dourado className="mx-auto w-24" />
            <h1 className="pt-3 font-display text-3xl text-marfim">{t.festa.titulo}</h1>
            <p className="text-xs uppercase tracking-[0.25em] text-fumaca">{dataLonga(t.festa.data_inicio)} · {hora(t.festa.data_inicio)}</p>
          </div>
          <div className="relative mx-6 border-t border-dashed border-linha">
            <span className="absolute -left-9 -top-3 h-6 w-6 rounded-full bg-noir" />
            <span className="absolute -right-9 -top-3 h-6 w-6 rounded-full bg-noir" />
          </div>
          <div className="p-6 text-center">
            {valido ? (
              <div className={`mx-auto w-fit rounded-2xl bg-white p-3 ${t.checkin_em ? "opacity-40" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR do ingresso" className="h-64 w-64" />
              </div>
            ) : (
              <p className="rounded-xl border border-perigo/50 bg-perigo/10 p-6 text-perigo">Ingresso cancelado</p>
            )}
            {t.checkin_em && <p className="mt-3 text-sm text-ouro">Entrada registrada em {dataHora(t.checkin_em)}</p>}
            <p className="mt-5 font-display text-2xl text-marfim">{t.nome_titular}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-fumaca">{SETORES[t.lote.setor] || t.lote.setor} · {t.lote.nome}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-left text-xs">
              <div className="rounded-xl border border-linha p-3"><p className="text-fumaca">Pedido</p><p className="font-mono text-marfim">{t.pedido.codigo}</p></div>
              <div className="rounded-xl border border-linha p-3"><p className="text-fumaca">Local</p><p className="text-marfim">{t.festa.local_nome || "GLAM House"}</p></div>
            </div>
            {t.festa.endereco && <p className="mt-3 text-xs text-fumaca">{t.festa.endereco}</p>}
            <p className="mt-5 text-[0.65rem] uppercase tracking-[0.2em] text-fumaca/70">Apresente este QR na portaria · entra uma vez só · não compartilhe print</p>
          </div>
        </article>
        {valido && !t.checkin_em && !passou && <Transferir codigo={t.codigo} />}
      </main>
    </>
  );
}
