import { db } from "@/lib/supabase-admin";
import { staffDaApi } from "@/lib/staff";
import { dataHora, SETORES, slugify } from "@/lib/format";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Planilha (CSV com ; para abrir direto no Excel em pt-BR) com todos os ingressos da festa. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await staffDaApi("relatorios");
  if (!staff) return new Response("Não autorizado", { status: 401 });
  const { id } = await params;
  const { data: festa } = await db().from("glam_festas").select("titulo").eq("id", id).maybeSingle();
  const { data } = await db()
    .from("glam_ingressos")
    .select("nome_titular,email_titular,checkin_em,status, lote:glam_lotes(nome,setor,preco_centavos), pedido:glam_pedidos!inner(codigo,status,canal,metodo,total_centavos,pago_em, promoter:glam_promoters(nome), cupom:glam_cupons(codigo))")
    .eq("festa_id", id).eq("pedido.status", "pago").order("criado_em");
  const linhas = [["Pedido", "Titular", "E-mail", "Setor", "Lote", "Preço lote", "Canal", "Pagamento", "Total pedido", "Cupom", "Promoter", "Pago em", "Situação", "Entrada"]];
  for (const i of (data || []) as any[]) {
    linhas.push([
      i.pedido.codigo, i.nome_titular, i.email_titular, SETORES[i.lote.setor] || i.lote.setor, i.lote.nome,
      (i.lote.preco_centavos / 100).toFixed(2).replace(".", ","), i.pedido.canal, i.pedido.metodo,
      (i.pedido.total_centavos / 100).toFixed(2).replace(".", ","), i.pedido.cupom?.codigo || "", i.pedido.promoter?.nome || "",
      dataHora(i.pedido.pago_em), i.status, i.checkin_em ? dataHora(i.checkin_em) : "",
    ]);
  }
  const csv = "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="glam-${slugify(festa?.titulo || "festa")}.csv"` } });
}
