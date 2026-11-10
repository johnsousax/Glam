import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/supabase-admin";
import { consultarSyncpay, tokenWebhookSyncpay } from "@/lib/syncpay";
import { confirmarPagamentoGateway } from "@/lib/pedidos";
import { pagamentos } from "@/lib/gateways";
import { falhaInterna, iguaisSeguro, ipDe, logSeguranca } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/**
 * Aviso da SyncPay (Pix), em camadas:
 * 1. token secreto na URL (k=…) — sem ele, 401;
 * 2. cada aviso é processado uma vez só;
 * 3. nunca confia no corpo: só usa o identificador e reconsulta a cobrança na API da SyncPay;
 * 4. só vale para um pedido nosso criado nesse gateway com esse identificador;
 * 5. só libera se o valor pago bater com o total do pedido.
 */
export async function POST(req: Request) {
  const k = new URL(req.url).searchParams.get("k");
  if (!iguaisSeguro(k, tokenWebhookSyncpay())) {
    logSeguranca("webhook_token_invalido", { ip: ipDe(req.headers), gateway: "syncpay" });
    return new NextResponse("não autorizado", { status: 401 });
  }
  const bruto = await req.text();
  if (bruto.length > 200_000) return new NextResponse("grande demais", { status: 413 });
  if (!(await pagamentos()).syncpay) return NextResponse.json({ ok: true });

  let corpo: any = null;
  try { corpo = JSON.parse(bruto); } catch { return NextResponse.json({ ok: true }); }
  const d = corpo?.data && typeof corpo.data === "object" ? corpo.data : corpo;
  const candidato = d?.id ?? d?.identifier ?? d?.reference_id ?? d?.idtransaction ?? d?.idTransaction ?? d?.transaction?.reference_id;
  const txId = typeof candidato === "string" && /^[A-Za-z0-9-]{8,80}$/.test(candidato) ? candidato : null;
  if (!txId) return NextResponse.json({ ok: true });

  const evento = `${txId}:${createHash("sha256").update(bruto).digest("hex").slice(0, 32)}`;
  const { data: primeiraVez } = await db().rpc("glam_registrar_evento", { p_provedor: "syncpay", p_evento: evento });
  if (primeiraVez === false) return NextResponse.json({ ok: true, repetido: true });

  try {
    const { data: p } = await db().from("glam_pedidos").select("id").eq("gateway", "syncpay").eq("gateway_tx_id", txId).maybeSingle();
    if (!p) return NextResponse.json({ ok: true, encontrado: false });
    const r = await consultarSyncpay(txId);
    if (!r.pago) return NextResponse.json({ ok: true, pago: false });
    await confirmarPagamentoGateway(p.id, r.valorPago, txId, "pix");
    return NextResponse.json({ ok: true });
  } catch (e) {
    falhaInterna("webhook_syncpay", e);
    // libera o aviso para ser reprocessado na nova tentativa
    await db().from("glam_webhook_eventos").delete().eq("provedor", "syncpay").eq("evento_id", evento);
    return NextResponse.json({ ok: false }, { status: 500 }); // a SyncPay tenta de novo
  }
}
