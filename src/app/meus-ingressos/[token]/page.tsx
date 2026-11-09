import Link from "next/link";
import { Cabecalho } from "@/components/Cabecalho";
import { db } from "@/lib/supabase-admin";
import { sha256 } from "@/lib/crypto";
import { dataLonga, hora, SETORES } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus ingressos", robots: { index: false } };

export default async function ListaIngressos({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: acesso } = await db().from("glam_acessos").select("*").eq("token_hash", sha256(token)).maybeSingle();
  const valido = acesso && new Date(acesso.expira_em) > new Date();

  if (!valido) {
    return (
      <>
        <Cabecalho />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-display text-4xl">Link expirado</h1>
          <p className="mt-3 text-sm text-fumaca">Peça um novo link de acesso.</p>
          <Link href="/meus-ingressos" className="btn-ouro ouro-gradiente mt-6">Pedir novo link</Link>
        </main>
      </>
    );
  }
  if (!acesso.usado_em) await db().from("glam_acessos").update({ usado_em: new Date().toISOString() }).eq("token_hash", acesso.token_hash);

  const { data: ingressos } = await db()
    .from("glam_ingressos")
    .select("codigo,nome_titular,checkin_em,status, festa:glam_festas(titulo,data_inicio,slug), lote:glam_lotes(nome,setor), pedido:glam_pedidos!inner(status)")
    .ilike("email_titular", acesso.email)
    .eq("status", "ativo")
    .eq("pedido.status", "pago")
    .order("criado_em", { ascending: false });

  const lista = (ingressos || []) as any[];
  const agora = Date.now() - 12 * 3600e3;
  const proximos = lista.filter((i) => +new Date(i.festa.data_inicio) >= agora);
  const passados = lista.filter((i) => +new Date(i.festa.data_inicio) < agora);

  const Item = ({ i }: { i: any }) => (
    <Link href={`/ingresso/${i.codigo}`} className="cartao flex items-center justify-between gap-4 p-5 transition hover:border-ouro/60">
      <div className="min-w-0">
        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ouro">{dataLonga(i.festa.data_inicio)} · {hora(i.festa.data_inicio)}</p>
        <p className="mt-1 truncate font-display text-2xl">{i.festa.titulo}</p>
        <p className="text-xs text-fumaca">{i.nome_titular} · {SETORES[i.lote.setor] || i.lote.setor} · {i.lote.nome}</p>
      </div>
      <span className="shrink-0 text-xs uppercase tracking-[0.2em] text-ouro">{i.checkin_em ? "Usado" : "QR →"}</span>
    </Link>
  );

  return (
    <>
      <Cabecalho />
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-12">
        <p className="text-[0.65rem] uppercase tracking-[0.45em] text-ouro">{acesso.email}</p>
        <h1 className="mt-2 font-display text-5xl">Meus ingressos</h1>
        <div className="mt-8 space-y-3">
          {proximos.length === 0 && <p className="cartao p-6 text-sm text-fumaca">Nenhum ingresso para as próximas festas.</p>}
          {proximos.map((i) => <Item key={i.codigo} i={i} />)}
        </div>
        {passados.length > 0 && (
          <>
            <h2 className="mt-12 text-xs uppercase tracking-[0.35em] text-fumaca">Festas que você já curtiu</h2>
            <div className="mt-4 space-y-3 opacity-60">{passados.map((i) => <Item key={i.codigo} i={i} />)}</div>
          </>
        )}
      </main>
    </>
  );
}
