import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/supabase-admin";
import { consultarPedido, tokenWebhook } from "@/lib/pagbank";
import { confirmarPagamentoGateway } from "@/lib/pedidos";
import { pagamentos } from "@/lib/gateways";
import { falhaInterna, iguaisSeguro, ipDe, logSeguranca } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/**
 * Aviso do PagBank, em camadas:
 * 1. token secreto na URL (k=…) — sem ele, 401;
 * 2. se vier x-authenticity-token, confere SHA256(token-PagBank + "-" + corpo);
 * 3. cada aviso é processado uma vez só;
 * 4. nunca confia no corpo: reconsulta o pedido na API do PagBank;
 * 5. só libera se o valor pago bater com o total do pedido.
 */
export async function POST(req: Request) {
  const { pagbank } = await pagamentos();
  if (!pagbank) return NextResponse.json({ ok: true });
  const k = new URL(req.url).searchParams.get("k");
  if (!iguaisSeguro(k, tokenWebhook())) {
    logSeguranca("webhook_token_invalido", { ip: ipDe(req.headers) });
    return new NextResponse("não autorizado", { status: 401 });
  }
  const bruto = await req.text();
  if (bruto.length > 200_000) return new NextResponse("grande demais", { status: 413 });

  const assinatura = req.headers.get("x-authenticity-token");
  if (assinatura) {
    const esperado = createHash("sha256").update(`${pagbank.token}-${bruto}`).digest("hex");
    if (!iguaisSeguro(assinatura.toLowerCase(), esperado)) {
      logSeguranca("webhook_assinatura_invalida", { ip: ipDe(req.headers) });
      return new NextResponse("assinatura inválida", { status: 401 });
    }
  }

  let corpo: any = null;
  try { corpo = JSON.parse(bruto); } catch { return NextResponse.json({ ok: true }); }
  const orderId: string | undefined = typeof corpo?.id === "string" && corpo.id.startsWith("ORDE_") ? corpo.id : undefined;
  if (!orderId || !/^ORDE_[A-Za-z0-9-]{8,80}$/.test(orderId)) return NextResponse.json({ ok: true });

  const evento = `${orderId}:${createHash("sha256").update(bruto).digest("hex").slice(0, 32)}`;
  const { data: primeiraVez } = await db().rpc("glam_registrar_evento", { p_provedor: "pagbank", p_evento: evento });
  if (primeiraVez === false) return NextResponse.json({ ok: true, repetido: true });

  try {
    const r = await consultarPedido(orderId);
    if (!r.pago) return NextResponse.json({ ok: true, pago: false });
    const { data: p } = await db().from("glam_pedidos").select("id,pagbank_order_id").eq("codigo", r.referencia).maybeSingle();
    if (!p) return NextResponse.json({ ok: true, encontrado: false });
    if (p.pagbank_order_id && p.pagbank_order_id !== orderId) {
      logSeguranca("webhook_pedido_divergente", { pedido: p.id });
      return NextResponse.json({ ok: true });
    }
    if (!p.pagbank_order_id) await db().from("glam_pedidos").update({ pagbank_order_id: orderId }).eq("id", p.id);
    await confirmarPagamentoGateway(p.id, r.valorPago, r.chargeId, r.metodo === "PIX" ? "pix" : "cartao");
    return NextResponse.json({ ok: true });
  } catch (e) {
    falhaInterna("webhook_pagbank", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // o PagBank tenta de novo
  }
}
