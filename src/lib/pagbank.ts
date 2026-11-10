import "server-only";
import { env } from "./env";
import { pagamentos } from "./gateways";
import { soDigitos } from "./format";
import { createHmac } from "crypto";

// API de Pedidos do PagBank: https://developer.pagbank.com.br/reference/criar-pedido
const BASE = (ambiente: string) => (ambiente === "production" ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com");

async function chamar<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { pagbank } = await pagamentos();
  if (!pagbank) throw new Error("PagBank: sem credenciais");
  const r = await fetch(BASE(pagbank.ambiente) + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${pagbank.token}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const texto = await r.text();
  let json: any = null;
  try { json = texto ? JSON.parse(texto) : null; } catch {}
  if (!r.ok) {
    const msg = json?.error_messages?.map((e: any) => e.description || e.message).join("; ") || texto || `HTTP ${r.status}`;
    throw new Error(`PagBank: ${msg}`);
  }
  return json as T;
}

export type DadosCobranca = {
  referencia: string;          // código do pedido GLM-XXXXXX
  totalCentavos: number;
  descricao: string;
  cliente: { nome: string; email: string; cpf: string; whatsapp?: string | null };
  itens: { referencia: string; nome: string; quantidade: number; unitarioCentavos: number }[];
};

function customer(c: DadosCobranca["cliente"]) {
  const tel = soDigitos(c.whatsapp || "").replace(/^55/, "");
  return {
    name: c.nome.slice(0, 120),
    email: c.email,
    tax_id: soDigitos(c.cpf),
    ...(tel.length >= 10
      ? { phones: [{ country: "55", area: tel.slice(0, 2), number: tel.slice(2), type: "MOBILE" }] }
      : {}),
  };
}

/** Token secreto na URL do aviso (o PagBank não assina com segredo nosso). */
export function tokenWebhook() {
  return createHmac("sha256", env.automacaoSecret || "sem-segredo").update("pagbank-webhook").digest("hex");
}
const notificacao = () => [`${env.siteUrl}/api/webhooks/pagbank?k=${tokenWebhook()}`];

export async function criarPix(d: DadosCobranca, expiraEm: Date) {
  const order = await chamar("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": `${d.referencia}-pix` },
    body: JSON.stringify({
      reference_id: d.referencia,
      customer: customer(d.cliente),
      items: d.itens.map((i) => ({ reference_id: i.referencia, name: i.nome.slice(0, 64), quantity: i.quantidade, unit_amount: i.unitarioCentavos })),
      qr_codes: [{ amount: { value: d.totalCentavos }, expiration_date: expiraEm.toISOString().replace(/\.\d{3}Z$/, "-00:00") }],
      notification_urls: notificacao(),
    }),
  });
  const qr = order.qr_codes?.[0];
  return {
    orderId: order.id as string,
    copiaCola: qr?.text as string,
    qrUrl: (qr?.links || []).find((l: any) => l.rel === "QRCODE.PNG")?.href as string | undefined,
  };
}

export async function criarCartao(d: DadosCobranca, cartaoCriptografado: string, titular: { nome: string; cpf: string }) {
  const order = await chamar("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": `${d.referencia}-card-${Date.now()}` },
    body: JSON.stringify({
      reference_id: d.referencia,
      customer: customer(d.cliente),
      items: d.itens.map((i) => ({ reference_id: i.referencia, name: i.nome.slice(0, 64), quantity: i.quantidade, unit_amount: i.unitarioCentavos })),
      charges: [
        {
          reference_id: d.referencia,
          description: d.descricao.slice(0, 64),
          amount: { value: d.totalCentavos, currency: "BRL" },
          payment_method: {
            type: "CREDIT_CARD",
            installments: 1,
            capture: true,
            soft_descriptor: "GLAMHOUSE",
            card: { encrypted: cartaoCriptografado, store: false },
            holder: { name: titular.nome.slice(0, 30), tax_id: soDigitos(titular.cpf) },
          },
        },
      ],
      notification_urls: notificacao(),
    }),
  });
  const charge = order.charges?.[0];
  return {
    valorPago: Number(charge?.amount?.summary?.paid ?? charge?.amount?.value ?? 0),
    orderId: order.id as string,
    chargeId: charge?.id as string | undefined,
    status: (charge?.status || "DECLINED") as string, // PAID | AUTHORIZED | IN_ANALYSIS | DECLINED
    motivo: charge?.payment_response?.message as string | undefined,
  };
}

/** Consulta o pedido direto no PagBank (fonte da verdade para liberar ingresso). */
export async function consultarPedido(orderId: string) {
  const order = await chamar(`/orders/${encodeURIComponent(orderId)}`);
  const pago = (order.charges || []).find((c: any) => c.status === "PAID");
  const valorPago = pago ? Number(pago.amount?.summary?.paid ?? pago.amount?.value ?? 0) : 0;
  return { referencia: order.reference_id as string, pago: !!pago, valorPago, chargeId: pago?.id as string | undefined, metodo: pago?.payment_method?.type as string | undefined };
}

let chavePublicaCache: { de: string; chave: string } | null = null;
export async function chavePublicaCartao() {
  const { pagbank } = await pagamentos();
  const de = `${pagbank?.ambiente}:${pagbank?.token.slice(-6)}`;
  if (chavePublicaCache?.de === de) return chavePublicaCache.chave;
  let chave: string;
  try {
    chave = (await chamar("/public-keys/card")).public_key;
  } catch {
    chave = (await chamar("/public-keys", { method: "POST", body: JSON.stringify({ type: "card" }) })).public_key;
  }
  chavePublicaCache = { de, chave };
  return chave;
}
