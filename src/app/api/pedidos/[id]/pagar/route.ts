import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { modoDemo } from "@/lib/env";
import { decifrar } from "@/lib/crypto";
import { criarCartao, criarPix, type DadosCobranca } from "@/lib/pagbank";
import { confirmarPagamento } from "@/lib/pedidos";
import { cpfValido, SETORES } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const metodo = b.metodo === "cartao" ? "cartao" : "pix";

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
    return NextResponse.json({ status: "pendente", copia_cola: p.pix_copia_cola, qr_url: p.pix_qr_url, expira_em: p.expira_em, demo: modoDemo() });
  }

  const cpf = p.cliente?.cpf_cifrado ? decifrar(p.cliente.cpf_cifrado) : "";
  const cobranca: DadosCobranca = {
    referencia: p.codigo,
    totalCentavos: p.total_centavos,
    descricao: `GLAM ${p.festa.titulo}`,
    cliente: { nome: p.cliente.nome, email: p.cliente.email, cpf, whatsapp: p.cliente.whatsapp },
    // Itens com desconto distribuído proporcionalmente (PagBank exige soma = total)
    itens: [{ referencia: p.codigo, nome: `Ingressos ${p.festa.titulo}`, quantidade: 1, unitarioCentavos: p.total_centavos }],
  };
  void SETORES;

  try {
    if (metodo === "pix") {
      if (modoDemo()) {
        const copia = `00020126DEMO-GLAM-${p.codigo}-PIX-SIMULADO5204000053039865802BR5909GLAM HOUSE6009SAO LUIS62070503***6304DEMO`;
        await db().from("glam_pedidos").update({ metodo: "pix", pix_copia_cola: copia }).eq("id", id);
        return NextResponse.json({ status: "pendente", copia_cola: copia, qr_url: null, expira_em: p.expira_em, demo: true });
      }
      const pix = await criarPix(cobranca, new Date(p.expira_em));
      await db().from("glam_pedidos").update({ metodo: "pix", pagbank_order_id: pix.orderId, pix_copia_cola: pix.copiaCola, pix_qr_url: pix.qrUrl }).eq("id", id);
      return NextResponse.json({ status: "pendente", copia_cola: pix.copiaCola, qr_url: pix.qrUrl, expira_em: p.expira_em });
    }

    // Cartão
    const titularNome = String(b.titular_nome || "").trim();
    const titularCpf = String(b.titular_cpf || "");
    if (!titularNome || !cpfValido(titularCpf)) return NextResponse.json({ erro: "Confira o nome e o CPF do titular do cartão." }, { status: 400 });
    if (modoDemo()) {
      await db().from("glam_pedidos").update({ metodo: "cartao" }).eq("id", id);
      await confirmarPagamento(p.id, "DEMO", "cartao");
      return NextResponse.json({ status: "pago", demo: true });
    }
    if (!b.cartao_criptografado) return NextResponse.json({ erro: "Dados do cartão inválidos." }, { status: 400 });
    const r = await criarCartao(cobranca, String(b.cartao_criptografado), { nome: titularNome, cpf: titularCpf });
    await db().from("glam_pedidos").update({ metodo: "cartao", pagbank_order_id: r.orderId, pagbank_charge_id: r.chargeId }).eq("id", id);
    if (r.status === "PAID") {
      await confirmarPagamento(p.id, r.chargeId, "cartao");
      return NextResponse.json({ status: "pago" });
    }
    if (r.status === "IN_ANALYSIS" || r.status === "AUTHORIZED") {
      return NextResponse.json({ status: "analise", mensagem: "Pagamento em análise pelo PagBank. Você recebe o ingresso assim que for aprovado." });
    }
    return NextResponse.json({ erro: r.motivo ? `Cartão recusado: ${r.motivo}` : "Cartão recusado. Tente outro cartão ou pague com Pix." }, { status: 402 });
  } catch (e) {
    console.error("pagar", e);
    return NextResponse.json({ erro: "Não foi possível falar com o PagBank agora. Tente novamente em instantes." }, { status: 502 });
  }
}
