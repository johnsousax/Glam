import "server-only";
import { db } from "./supabase-admin";
import { dispararN8n } from "./n8n";
import { configCasa } from "./config";
import { env } from "./env";
import { brl, dataLonga, hora, SETORES } from "./format";

const ERROS: Record<string, string> = {
  FESTA_NAO_ENCONTRADA: "Festa não encontrada.",
  FESTA_INDISPONIVEL: "As vendas desta festa não estão abertas.",
  ITENS_INVALIDOS: "Escolha ao menos um ingresso.",
  QUANTIDADE_INVALIDA: "Quantidade inválida.",
  LOTE_INVALIDO: "Lote inválido.",
  LOTE_INDISPONIVEL: "Este lote não está disponível.",
  LOTE_NAO_INICIADO: "Este lote ainda não começou a ser vendido.",
  LOTE_ENCERRADO: "Este lote já encerrou. Atualize a página para ver o próximo.",
  LIMITE_POR_PEDIDO: "Quantidade acima do limite por pedido.",
  LOTE_ESGOTADO: "Esgotou! Alguém garantiu as últimas vagas deste lote.",
  FESTA_LOTADA: "A festa atingiu a lotação máxima.",
  CUPOM_INVALIDO: "Cupom inválido.",
  CUPOM_EXPIRADO: "Cupom expirado.",
  CUPOM_ESGOTADO: "Este cupom atingiu o limite de usos.",
  CUPOM_NAO_SE_APLICA: "Este cupom não vale para os ingressos escolhidos.",
  CUPOM_LIMITE_CLIENTE: "Você já usou este cupom o máximo de vezes permitido.",
  MUITAS_RESERVAS: "Você já tem reservas abertas. Pague ou aguarde elas expirarem.",
  IDEMPOTENCIA_INVALIDA: "Requisição inválida. Atualize a página.",
  PEDIDO_CANCELADO: "Este pedido foi cancelado.",
};

export function traduzirErro(msg: string) {
  const [cod, extra] = msg.split(":");
  const base = ERROS[cod.trim()];
  if (!base) return "Não foi possível concluir. Tente novamente.";
  return extra && cod.startsWith("LIMITE") ? `${base} (máx. ${extra})` : base;
}

/** Dados completos de um pedido para telas, e-mail e WhatsApp. */
export async function pedidoCompleto(pedidoId: string) {
  const { data: p } = await db()
    .from("glam_pedidos")
    .select("*, cliente:glam_clientes(id,nome,email,whatsapp), festa:glam_festas(*), itens:glam_pedido_itens(*, lote:glam_lotes(nome,setor,pessoas_por_unidade)), promoter:glam_promoters(nome,codigo), cupom:glam_cupons(codigo)")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!p) return null;
  const { data: ingressos } = await db()
    .from("glam_ingressos")
    .select("id,codigo,nome_titular,status,checkin_em,lote:glam_lotes(nome,setor)")
    .eq("pedido_id", pedidoId)
    .order("criado_em");
  return { ...p, ingressos: ingressos || [] } as any;
}

export async function payloadNotificacao(pedidoId: string) {
  const p = await pedidoCompleto(pedidoId);
  if (!p) return null;
  const casa = await configCasa();
  return {
    casa: { nome: casa.nome, whatsapp: casa.whatsapp_casa, whatsapp_dono: casa.whatsapp_dono, email_dono: casa.email_dono, email_remetente: casa.email_remetente, evolution_instancia: casa.evolution_instancia, instagram: casa.instagram },
    pedido: {
      id: p.id, codigo: p.codigo, total: p.total_centavos, total_fmt: brl(p.total_centavos), metodo: p.metodo, canal: p.canal,
      url: `${env.siteUrl}/pedido/${p.id}`,
    },
    cliente: p.cliente,
    festa: {
      titulo: p.festa.titulo, data: dataLonga(p.festa.data_inicio), hora: hora(p.festa.data_inicio),
      local: p.festa.local_nome, endereco: p.festa.endereco || casa.endereco, cartaz_url: p.festa.cartaz_url,
      url: `${env.siteUrl}/festa/${p.festa.slug}`,
    },
    ingressos: p.ingressos.map((i: any) => ({
      nome: i.nome_titular, codigo: i.codigo, setor: SETORES[i.lote?.setor] || i.lote?.setor, lote: i.lote?.nome,
      url: `${env.siteUrl}/ingresso/${i.codigo}`, qr_url: `${env.siteUrl}/api/qr/${i.codigo}`,
    })),
    meus_ingressos_url: `${env.siteUrl}/meus-ingressos`,
  };
}

/**
 * Pagamento vindo do gateway: só libera se o valor pago for exatamente o esperado:
 * o total do pedido (Pix) ou o total + a taxa do cartão gravada no pedido (cartão).
 * Valor divergente = pedido vai para revisão e o dono recebe alerta.
 */
export async function confirmarPagamentoGateway(pedidoId: string, valorPago: number, chargeId?: string | null, metodo?: string | null) {
  const { data: p } = await db().from("glam_pedidos").select("codigo,total_centavos,taxa_cartao_centavos,status").eq("id", pedidoId).single();
  if (!p) return null;
  const esperado = p.total_centavos + (metodo === "cartao" ? p.taxa_cartao_centavos || 0 : 0);
  if (valorPago !== esperado) {
    await db().from("glam_pedidos").update({ em_revisao: true, motivo_revisao: `Valor pago ${valorPago} ≠ esperado ${esperado}` }).eq("id", pedidoId);
    const casa = await configCasa();
    await dispararN8n("alerta_seguranca", {
      casa: { whatsapp_dono: casa.whatsapp_dono, email_dono: casa.email_dono, email_remetente: casa.email_remetente, evolution_instancia: casa.evolution_instancia },
      texto: `⚠️ Pedido ${p.codigo}: valor pago (${brl(valorPago)}) diferente do esperado (${brl(esperado)}). Ingressos NÃO liberados — revise no painel.`,
    }, p.codigo);
    return null;
  }
  return confirmarPagamento(pedidoId, chargeId, metodo);
}

/** Confirma o pagamento (idempotente), emite ingressos e dispara as automações. */
export async function confirmarPagamento(pedidoId: string, chargeId?: string | null, metodo?: string | null) {
  const { data, error } = await db().rpc("glam_confirmar_pedido", {
    p_pedido_id: pedidoId, p_charge_id: chargeId ?? null, p_metodo: metodo ?? null,
  });
  if (error) throw new Error(error.message);
  const r = data as { confirmado_agora: boolean; lotes_esgotados: string[] };
  if (r.confirmado_agora) {
    const payload = await payloadNotificacao(pedidoId);
    if (payload) {
      const st = await dispararN8n("pedido_pago", payload, payload.pedido.codigo);
      if (st === "enviado") await db().from("glam_pedidos").update({ notificado_em: new Date().toISOString() }).eq("id", pedidoId);
    }
    for (const loteId of r.lotes_esgotados || []) {
      const { data: l } = await db().from("glam_lotes").select("nome,setor,capacidade,festa:glam_festas(titulo)").eq("id", loteId).maybeSingle();
      const casa = await configCasa();
      if (l) await dispararN8n("lote_esgotado", {
        casa: { whatsapp_dono: casa.whatsapp_dono, email_dono: casa.email_dono, email_remetente: casa.email_remetente, evolution_instancia: casa.evolution_instancia },
        lote: { nome: l.nome, setor: SETORES[l.setor] || l.setor, capacidade: l.capacidade }, festa: (l as any).festa,
      }, loteId);
    }
  }
  return r;
}
