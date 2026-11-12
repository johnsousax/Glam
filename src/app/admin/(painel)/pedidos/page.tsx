import Link from "next/link";
import { db } from "@/lib/supabase-admin";
import { exigirStaff, pode } from "@/lib/staff";
import { brl, dataHora } from "@/lib/format";
import { Selo, STATUS_PEDIDO, Titulo } from "@/components/admin/Titulo";
import { Confirmar, FormAcao, Enviar } from "@/components/admin/ui";
import { cancelarPedido, confirmarManual, reenviarIngressos } from "../../acoes";

export const dynamic = "force-dynamic";

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ festa?: string; status?: string; q?: string }> }) {
  const staff = await exigirStaff("pedidos");
  const sp = await searchParams;
  let q = db().from("glam_pedidos")
    .select("id,codigo,status,canal,metodo,total_centavos,taxa_cartao_centavos,desconto_centavos,criado_em,pago_em,motivo_cancelamento,em_revisao,motivo_revisao, cliente:glam_clientes!inner(nome,email,whatsapp), festa:glam_festas(titulo), promoter:glam_promoters(nome), cupom:glam_cupons(codigo), itens:glam_pedido_itens(quantidade, lote:glam_lotes(nome))")
    .order("criado_em", { ascending: false }).limit(150);
  if (sp.festa) q = q.eq("festa_id", sp.festa);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.q) {
    const termo = sp.q.trim().slice(0, 80).replace(/[%_,()*\\]/g, " ");
    q = /^GLM-/i.test(termo) ? q.ilike("codigo", termo) : q.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`, { referencedTable: "glam_clientes" });
  }
  const [{ data: pedidos }, { data: festas }] = await Promise.all([q, db().from("glam_festas").select("id,titulo").order("data_inicio", { ascending: false }).limit(50)]);
  const podeCancelar = pode(staff, "cancelar");

  return (
    <>
      <Titulo sup="Vendas" titulo="Pedidos" />
      <form className="mb-6 grid gap-3 sm:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder="Nome, e-mail ou GLM-XXXXXX" className="campo sm:col-span-2" />
        <select name="festa" defaultValue={sp.festa || ""} className="campo"><option value="">Todas as festas</option>{(festas || []).map((f: any) => <option key={f.id} value={f.id}>{f.titulo}</option>)}</select>
        <select name="status" defaultValue={sp.status || ""} className="campo"><option value="">Todos</option>{Object.entries(STATUS_PEDIDO).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}</select>
        <button className="btn-linha sm:col-span-4 sm:w-fit">Filtrar</button>
      </form>
      <div className="space-y-3">
        {(pedidos || []).length === 0 && <p className="cartao p-8 text-center text-fumaca">Nenhum pedido encontrado.</p>}
        {(pedidos || []).map((p: any) => {
          const st = STATUS_PEDIDO[p.status];
          return (
            <details key={p.id} className="cartao group p-4">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-mono text-sm text-ouro">{p.codigo}</span>
                <span className="min-w-0 flex-1 truncate">{p.cliente.nome} <span className="text-fumaca">· {p.festa.titulo}</span></span>
                <span className="text-sm">{brl(p.total_centavos)}</span>
                <Selo cor={st.c}>{st.t}</Selo>
                {p.em_revisao && <Selo cor="perigo">em revisão</Selo>}
                <span className="w-full text-xs text-fumaca sm:w-auto">{dataHora(p.criado_em)}</span>
              </summary>
              <div className="mt-4 grid gap-4 border-t border-linha pt-4 text-sm md:grid-cols-2">
                <div className="space-y-1 text-fumaca">
                  <p>{p.itens.map((i: any) => `${i.quantidade}× ${i.lote.nome}`).join(", ")}</p>
                  <p>{p.cliente.email} · {p.cliente.whatsapp || "sem WhatsApp"}</p>
                  <p>Canal: {p.canal} · Pagamento: {p.metodo || "—"}{p.pago_em ? ` · pago ${dataHora(p.pago_em)}` : ""}</p>
                  {p.metodo === "cartao" && p.taxa_cartao_centavos > 0 && <p>Taxa do cartão paga pelo cliente: {brl(p.taxa_cartao_centavos)} (não entra no faturamento)</p>}
                  {p.cupom && <p>Cupom {p.cupom.codigo} (−{brl(p.desconto_centavos)})</p>}
                  {p.promoter && <p>Promoter: {p.promoter.nome}</p>}
                  {p.motivo_cancelamento && <p className="text-perigo">Cancelado: {p.motivo_cancelamento}</p>}
                  {p.motivo_revisao && <p className="text-perigo">Revisão: {p.motivo_revisao} — confira no app do PagBank antes de confirmar manualmente.</p>}
                  <Link href={`/pedido/${p.id}`} target="_blank" className="text-ouro underline">Abrir página do pedido ↗</Link>
                </div>
                <div className="flex flex-col gap-3">
                  {p.status === "pago" && (
                    <FormAcao acao={reenviarIngressos}><input type="hidden" name="id" value={p.id} /><Confirmar mensagem={`Reenviar os ingressos do pedido ${p.codigo} para ${p.cliente.email}?`} className="btn-linha w-full">Reenviar ingressos</Confirmar></FormAcao>
                  )}
                  {podeCancelar && p.status === "pendente" && (
                    <form action={confirmarManual}><input type="hidden" name="id" value={p.id} /><button className="btn-linha w-full">Confirmar pagamento manualmente</button></form>
                  )}
                  {podeCancelar && (p.status === "pago" || p.status === "pendente") && (
                    <FormAcao acao={cancelarPedido} className="space-y-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="motivo" className="campo !py-2 text-sm" placeholder="Motivo do cancelamento" required />
                      <Enviar className="w-full rounded-full border border-perigo/50 px-4 py-2 text-xs uppercase tracking-[0.2em] text-perigo hover:bg-perigo/10">Cancelar pedido</Enviar>
                    </FormAcao>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
