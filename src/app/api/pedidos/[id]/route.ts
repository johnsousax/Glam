import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { modoDemo } from "@/lib/env";
import { consultarPedido } from "@/lib/pagbank";
import { confirmarPagamento } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

/** Status do pedido (consultado pela tela de pagamento a cada poucos segundos). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: p } = await db().from("glam_pedidos").select("id,status,expira_em,pagbank_order_id,criado_em").eq("id", id).maybeSingle();
  if (!p) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });

  // Plano B caso o aviso do PagBank atrase: consulta direto a API.
  if (p.status === "pendente" && p.pagbank_order_id && !modoDemo()) {
    try {
      const r = await consultarPedido(p.pagbank_order_id);
      if (r.pago) {
        await confirmarPagamento(p.id, r.chargeId, r.metodo === "PIX" ? "pix" : "cartao");
        return NextResponse.json({ status: "pago" });
      }
    } catch {}
  }
  const status = p.status === "pendente" && new Date(p.expira_em) < new Date() ? "expirado" : p.status;
  return NextResponse.json({ status, expira_em: p.expira_em });
}
