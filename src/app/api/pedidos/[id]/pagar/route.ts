import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { pagamentos } from "@/lib/gateways";
import { criarPixSyncpay } from "@/lib/syncpay";
import { decifrar } from "@/lib/crypto";
import { criarCartao, criarPix, type DadosCobranca } from "@/lib/pagbank";
import { confirmarPagamento, confirmarPagamentoGateway } from "@/lib/pedidos";
import { Pagar, lerCorpo } from "@/lib/esquemas";
import { dentroDoLimite, falhaInterna, ipDe, origemValida, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  if (!origemValida(req)) return NextResponse.json({ erro: "Requisição inválida." }, { status: 403 });
  const ip = ipDe(req.headers);
  if (!(await dentroDoLimite(`pagar:ip:${ip}`, 30, 3600)) || !(await dentroDoLimite(`pagar:pedido:${id}`, 10, 3600))) return respostaLimite();
  const b = await lerCorpo(req, Pagar, 16_000);
  if (!b) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  const metodo = b.metodo;

  const { data: p } = await db()
    .from("glam_pedidos")
    .select("*, cliente:glam_clientes(*), festa:glam_festas(titulo), itens:glam_pedido_itens(*, lote:glam_lotes(nome,setor))")
    .eq("id", id)
    .maybeSingle();
  if (!p) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
  if (p.status === "pago") return NextResponse.json({ status: "pago" });
  if (p.status !== "pendente" || new Date(p.expira_em) < new Date()) {
    return NextResponse.json({ erro: "O tempo de reserva acabou. Faça um novo pedido." }, { status: 410 });
  }

  // Pedido gratuito (cupom de 100%): confirma direto
  if (p.total_centavos === 0) {
    await confirmarPagamento(p.id, null, "cortesia");
    return NextResponse.json({ status: "pago" });
  }

  // Reaproveita o Pix já gerado
  if (metodo === "pix" && p.pix_copia_cola) {
    return NextResponse.json({ status: "pendente", copia_cola: p.pix_copia_cola, qr_url: p.pix_qr_url, expira_em: p.expira_em, demo: p.gateway === "demo" });
  }
  const pg = await pagamentos();

  const cpf = p.cliente?.cpf_cifrado ? decifrar(p.cliente.cpf_cifrado) : "";
  const cobranca: DadosCobranca = {
    referencia: p.codigo,
    totalCentavos: p.total_centavos,
    descricao: `GLAM ${p.festa.titulo}`,
    cliente: { nome: p.cliente.nome, email: p.cliente.email, cpf, whatsapp: p.cliente.whatsapp },
    // Um item com o total já descontado (o PagBank exige soma dos itens = total)
    itens: [{ referencia: p.codigo, nome: `Ingressos ${p.festa.titulo}`, quantidade: 1, unitarioCentavos: p.total_centavos }],
  };

  try {
    if (metodo === "pix") {
      if (pg.demo) {
        const copia = `00020126DEMO-GLAM-${p.codigo}-PIX-SIMULADO5204000053039865802BR5909GLAM HOUSE6009SAO LUIS62070503***6304DEMO`;
        await db().from("glam_pedidos").update({ metodo: "pix", gateway: "demo", pix_copia_cola: copia }).eq("id", id);
        return NextResponse.json({ status: "pendente", copia_cola: copia, qr_url: null, expira_em: p.expira_em, demo: true });
      }
      if (pg.pix === "syncpay") {
        const sp = await criarPixSyncpay(cobranca);
        await db().from("glam_pedidos").update({ metodo: "pix", gateway: "syncpay", gateway_tx_id: sp.id, pix_copia_cola: sp.copiaCola }).eq("id", id);
        return NextResponse.json({ status: "pendente", copia_cola: sp.copiaCola, qr_url: null, expira_em: p.expira_em });
      }
      const pix = await criarPix(cobranca, new Date(p.expira_em));
      await db().from("glam_pedidos").update({ metodo: "pix", gateway: "pagbank", gateway_tx_id: pix.orderId, pagbank_order_id: pix.orderId, pix_copia_cola: pix.copiaCola, pix_qr_url: pix.qrUrl }).eq("id", id);
      return NextResponse.json({ status: "pendente", copia_cola: pix.copiaCola, qr_url: pix.qrUrl, expira_em: p.expira_em });
    }

    // Cartão (o número nunca passa por aqui: chega criptografado pelo SDK do PagBank no navegador)
    if (b.metodo !== "cartao") return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
    const titularNome = b.titular_nome;
    const titularCpf = b.titular_cpf;
    if (pg.demo) {
      await db().from("glam_pedidos").update({ metodo: "cartao", gateway: "demo" }).eq("id", id);
      await confirmarPagamento(p.id, "DEMO", "cartao");
      return NextResponse.json({ status: "pago", demo: true });
    }
    if (!pg.cartao) return NextResponse.json({ erro: "Pagamento com cartão indisponível. Use o Pix." }, { status: 400 });
    if (!b.cartao_criptografado) return NextResponse.json({ erro: "Dados do cartão inválidos." }, { status: 400 });
    const r = await criarCartao(cobranca, String(b.cartao_criptografado), { nome: titularNome, cpf: titularCpf });
    await db().from("glam_pedidos").update({ metodo: "cartao", gateway: "pagbank", gateway_tx_id: r.orderId, pagbank_order_id: r.orderId, pagbank_charge_id: r.chargeId }).eq("id", id);
    if (r.status === "PAID") {
      const ok = await confirmarPagamentoGateway(p.id, r.valorPago, r.chargeId, "cartao");
      return NextResponse.json(ok ? { status: "pago" } : { status: "analise", mensagem: "Pagamento em análise. Você recebe o ingresso assim que for conferido." });
    }
    if (r.status === "IN_ANALYSIS" || r.status === "AUTHORIZED") {
      return NextResponse.json({ status: "analise", mensagem: "Pagamento em análise pelo PagBank. Você recebe o ingresso assim que for aprovado." });
    }
    return NextResponse.json({ erro: r.motivo ? `Cartão recusado: ${r.motivo}` : "Cartão recusado. Tente outro cartão ou pague com Pix." }, { status: 402 });
  } catch (e) {
    const f = falhaInterna("pagar", e);
    return NextResponse.json({ erro: `Não foi possível gerar o pagamento agora. Tente de novo. (${f.ref})` }, { status: 502 });
  }
}
