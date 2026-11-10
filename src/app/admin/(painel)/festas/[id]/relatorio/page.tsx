import { notFound } from "next/navigation";
import { SairPara } from "@/components/admin/Fechar";
import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { brl, dataHora, dataLonga, hora, SETORES } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { Imprimir } from "./Imprimir";

export const dynamic = "force-dynamic";

export default async function Relatorio({ params }: { params: Promise<{ id: string }> }) {
  await exigirStaff("relatorios");
  const { id } = await params;
  const { data: festa } = await db().from("glam_festas").select("*").eq("id", id).maybeSingle();
  if (!festa) notFound();
  const [{ data: c }, { data: pedidos }, { data: lotes }, { data: ingressos }] = await Promise.all([
    db().rpc("glam_festa_contadores", { p_festa_id: id }),
    db().from("glam_pedidos").select("id,codigo,status,canal,metodo,total_centavos,desconto_centavos,pago_em, promoter:glam_promoters(nome,comissao_percentual), cliente:glam_clientes(nome)").eq("festa_id", id).eq("status", "pago").order("pago_em"),
    db().from("glam_lotes").select("id,nome,setor,preco_centavos,capacidade").eq("festa_id", id).order("setor").order("ordem"),
    db().from("glam_ingressos").select("lote_id,checkin_em,status, pedido:glam_pedidos!inner(status)").eq("festa_id", id).eq("status", "ativo").eq("pedido.status", "pago"),
  ]);
  const porLote = new Map<string, { vendidos: number; entraram: number }>();
  for (const i of (ingressos || []) as any[]) {
    const v = porLote.get(i.lote_id) || { vendidos: 0, entraram: 0 };
    v.vendidos++; if (i.checkin_em) v.entraram++;
    porLote.set(i.lote_id, v);
  }
  const ps = (pedidos || []) as any[];
  const soma = (fn: (p: any) => boolean) => ps.filter(fn).reduce((t, p) => t + p.total_centavos, 0);
  const promoters = new Map<string, { nome: string; total: number; pedidos: number; pct: number }>();
  ps.filter((p) => p.promoter).forEach((p) => {
    const k = p.promoter.nome;
    const v = promoters.get(k) || { nome: k, total: 0, pedidos: 0, pct: Number(p.promoter.comissao_percentual) };
    v.total += p.total_centavos; v.pedidos++;
    promoters.set(k, v);
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="nao-imprimir mb-6 flex flex-wrap gap-2">
        <Imprimir />
        <a href={`/admin/festas/${id}/relatorio/csv`} className="btn-linha">Baixar planilha (CSV)</a>
        <SairPara href={`/admin/festas/${id}`} rotulo="Voltar para a festa" />
      </div>
      <div className="cartao space-y-8 p-8">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-ouro">Relatório da festa</p>
            <h1 className="mt-1 font-display text-4xl">{festa.titulo}</h1>
            <p className="text-sm text-fumaca">{dataLonga(festa.data_inicio)} · {hora(festa.data_inicio)} · gerado em {dataHora(new Date())}</p>
          </div>
          <Logo className="w-24" />
        </header>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[["Faturamento", brl(c?.faturamento)], ["Ingressos", c?.ingressos], ["Entraram", c?.entraram], ["Lista", `${c?.lista_entraram}/${c?.lista}`]].map(([r, v]) => (
            <div key={String(r)} className="rounded-xl border border-linha p-4"><p className="text-[0.6rem] uppercase tracking-[0.25em] text-fumaca">{r}</p><p className="mt-1 font-display text-2xl">{String(v ?? 0)}</p></div>
          ))}
        </div>
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-[0.3em] text-fumaca">Por forma de pagamento</h2>
          <table className="w-full text-sm"><tbody>
            {[["Pix", soma((p) => p.metodo === "pix")], ["Cartão", soma((p) => p.metodo === "cartao")], ["Balcão (dinheiro/maquininha)", soma((p) => p.canal === "balcao")], ["Cortesias", ps.filter((p) => p.canal === "cortesia").length + " pedidos"], ["Descontos de cupom", brl(ps.reduce((t, p) => t + (p.canal === "site" ? p.desconto_centavos : 0), 0))]].map(([k, v]) => (
              <tr key={String(k)} className="border-b border-linha/60"><td className="py-2">{k}</td><td className="py-2 text-right">{typeof v === "number" ? brl(v) : v}</td></tr>
            ))}
          </tbody></table>
        </section>
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-[0.3em] text-fumaca">Por lote</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-[0.6rem] uppercase tracking-[0.2em] text-fumaca"><tr><th className="py-2">Lote</th><th>Preço</th><th>Vendidos</th><th>Entraram</th><th className="text-right">Bruto</th></tr></thead>
            <tbody>{(lotes || []).map((l: any) => { const v = porLote.get(l.id) || { vendidos: 0, entraram: 0 }; return (
              <tr key={l.id} className="border-b border-linha/60"><td className="py-2">{SETORES[l.setor] || l.setor} · {l.nome}</td><td>{brl(l.preco_centavos)}</td><td>{v.vendidos}</td><td>{v.entraram}</td><td className="text-right">{brl(v.vendidos * l.preco_centavos)}</td></tr>
            ); })}</tbody>
          </table>
        </section>
        {promoters.size > 0 && (
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-[0.3em] text-fumaca">Promoters e comissões</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-[0.6rem] uppercase tracking-[0.2em] text-fumaca"><tr><th className="py-2">Promoter</th><th>Pedidos</th><th>Vendido</th><th className="text-right">Comissão</th></tr></thead>
              <tbody>{[...promoters.values()].map((p) => (
                <tr key={p.nome} className="border-b border-linha/60"><td className="py-2">{p.nome}</td><td>{p.pedidos}</td><td>{brl(p.total)}</td><td className="text-right">{brl(Math.round(p.total * p.pct / 100))} ({p.pct}%)</td></tr>
              ))}</tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
