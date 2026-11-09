import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { consultarPedido } from "@/lib/pagbank";
import { confirmarPagamento } from "@/lib/pedidos";
import { modoDemo } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Aviso do PagBank. Nunca confiamos no corpo recebido: reconsultamos o pedido
 * direto na API do PagBank e só liberamos o ingresso se a cobrança estiver PAID.
 */
export async function POST(req: Request) {
  if (modoDemo()) return NextResponse.json({ ok: true });
  const corpo = await req.json().catch(() => null);
  const orderId: string | undefined = corpo?.id && String(corpo.id).startsWith("ORDE_") ? corpo.id : corpo?.order_id;
  if (!orderId) return NextResponse.json({ ok: true });
  try {
    const r = await consultarPedido(orderId);
    if (!r.pago) return NextResponse.json({ ok: true, pago: false });
    const { data: p } = await db().from("glam_pedidos").select("id,pagbank_order_id").eq("codigo", r.referencia).maybeSingle();
    if (!p) return NextResponse.json({ ok: true, encontrado: false });
    if (!p.pagbank_order_id) await db().from("glam_pedidos").update({ pagbank_order_id: orderId }).eq("id", p.id);
    await confirmarPagamento(p.id, r.chargeId, r.metodo === "PIX" ? "pix" : "cartao");
    return NextResponse.json({ ok: true, pago: true });
  } catch (e) {
    console.error("webhook pagbank", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // PagBank tenta de novo
  }
}
