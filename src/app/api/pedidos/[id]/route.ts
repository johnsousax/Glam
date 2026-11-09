import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { modoDemo } from "@/lib/env";
import { consultarPedido } from "@/lib/pagbank";
import { confirmarPagamentoGateway } from "@/lib/pedidos";
import { dentroDoLimite, ipDe, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/** Status do pedido (consultado pela tela de pagamento a cada poucos segundos). Não expõe dados pessoais. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  if (!(await dentroDoLimite(`status:${ipDe(req.headers)}`, 400, 600))) return respostaLimite();
  const { data: p } = await db().from("glam_pedidos").select("id,status,expira_em,pagbank_order_id").eq("id", id).maybeSingle();
  if (!p) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });

  // Plano B se o aviso do PagBank atrasar: consulta a API (no máximo a cada 10 s por pedido)
  if (p.status === "pendente" && p.pagbank_order_id && !modoDemo() && (await dentroDoLimite(`pb:${id}`, 1, 10))) {
    try {
      const r = await consultarPedido(p.pagbank_order_id);
      if (r.pago) {
        await confirmarPagamentoGateway(p.id, r.valorPago, r.chargeId, r.metodo === "PIX" ? "pix" : "cartao");
        const { data: depois } = await db().from("glam_pedidos").select("status").eq("id", id).single();
        return NextResponse.json({ status: depois?.status || "pendente" });
      }
    } catch {}
  }
  const status = p.status === "pendente" && new Date(p.expira_em) < new Date() ? "expirado" : p.status;
  return NextResponse.json({ status, expira_em: p.expira_em });
}
