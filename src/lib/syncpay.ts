import "server-only";
import { createHmac } from "crypto";
import { env } from "./env";
import { soDigitos } from "./format";
import { pagamentos, type CredSyncpay } from "./gateways";
import type { DadosCobranca } from "./pagbank";

// API da SyncPay (Pix): https://syncpay.apidog.io
const BASE = "https://api.syncpayments.com.br";

let tokenCache: { de: string; token: string; ate: number } | null = null;

async function resposta(r: Response) {
  const texto = await r.text();
  let json: any = null;
  try { json = texto ? JSON.parse(texto) : null; } catch {}
  return { json, texto };
}

/** Troca client_id + client_secret por um token (vale 1 h; reaproveitado enquanto valer). */
export async function tokenSyncpay(cred: CredSyncpay, forcar = false): Promise<string> {
  if (!forcar && tokenCache && tokenCache.de === cred.clientId && tokenCache.ate > Date.now()) return tokenCache.token;
  const r = await fetch(`${BASE}/api/partner/v1/auth-token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: cred.clientId, client_secret: cred.clientSecret }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const { json } = await resposta(r);
  if (!r.ok || !json?.access_token) throw new Error(`SyncPay: credenciais recusadas (HTTP ${r.status})`);
  const validade = Math.max(60, Number(json.expires_in) || 3600) - 120;
  tokenCache = { de: cred.clientId, token: String(json.access_token), ate: Date.now() + validade * 1000 };
  return tokenCache.token;
}

async function chamar(path: string, init: RequestInit = {}) {
  const { syncpay } = await pagamentos();
  if (!syncpay) throw new Error("SyncPay: sem credenciais");
  const enviar = async (token: string) => fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json", ...(init.headers || {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  let r = await enviar(await tokenSyncpay(syncpay));
  if (r.status === 401) r = await enviar(await tokenSyncpay(syncpay, true));
  const { json, texto } = await resposta(r);
  return { ok: r.ok, status: r.status, json, texto };
}

/** Token secreto na URL do aviso: sem ele, o aviso é recusado. */
export function tokenWebhookSyncpay() {
  return createHmac("sha256", env.automacaoSecret || "sem-segredo").update("syncpay-webhook").digest("hex");
}

export async function criarPixSyncpay(d: DadosCobranca) {
  const tel = soDigitos(d.cliente.whatsapp || "").replace(/^55/, "");
  const r = await chamar("/api/partner/v1/cash-in", {
    method: "POST",
    body: JSON.stringify({
      amount: d.totalCentavos / 100,
      description: `${d.descricao} ${d.referencia}`.slice(0, 120),
      webhook_url: `${env.siteUrl}/api/webhooks/syncpay?k=${tokenWebhookSyncpay()}`,
      client: {
        name: d.cliente.nome.slice(0, 120),
        cpf: soDigitos(d.cliente.cpf),
        email: d.cliente.email,
        phone: tel.length >= 10 ? tel : "98900000000",
      },
    }),
  });
  const id = r.json?.identifier, copiaCola = r.json?.pix_code;
  if (!r.ok || typeof id !== "string" || typeof copiaCola !== "string") {
    throw new Error(`SyncPay: ${r.json?.message || r.texto.slice(0, 200) || `HTTP ${r.status}`}`);
  }
  return { id, copiaCola };
}

const PAGO = new Set(["completed", "paid", "approved"]);

/** Consulta a cobrança direto na SyncPay (fonte da verdade para liberar ingresso). */
export async function consultarSyncpay(id: string) {
  const alvo = encodeURIComponent(id);
  let r = await chamar(`/api/partner/v2/transactions/${alvo}`);
  let t = r.json?.data?.transaction;
  if (!r.ok || !t) {
    r = await chamar(`/api/partner/v1/transaction/${alvo}`);
    t = r.json?.data;
  }
  if (!r.ok || !t) throw new Error(`SyncPay: consulta falhou (HTTP ${r.status})`);
  const status = String(t.status || "").toLowerCase();
  const pago = PAGO.has(status);
  return { pago, status, valorPago: pago ? Math.round(Number(t.amount) * 100) : 0 };
}
