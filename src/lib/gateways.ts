import "server-only";
import { db } from "./supabase-admin";
import { cifrar, decifrar } from "./crypto";
import { env } from "./env";

/**
 * Gateways de pagamento, configurados no painel (Configurações › Pagamentos).
 * - SyncPay: Pix.
 * - PagBank: Pix e cartão.
 * As credenciais ficam em glam_segredos, cifradas com AES-256-GCM (a chave nunca vai para o banco).
 */
export type GatewayPix = "syncpay" | "pagbank";
export type CredSyncpay = { clientId: string; clientSecret: string };
export type CredPagbank = { token: string; ambiente: "sandbox" | "production" };

export type Pagamentos = {
  /** Quem gera o Pix agora ("demo" = nenhum gateway conectado, nada é cobrado). */
  pix: GatewayPix | "demo";
  /** Preferência salva no painel. */
  preferido: GatewayPix;
  cartao: boolean;
  demo: boolean;
  syncpay: CredSyncpay | null;
  pagbank: CredPagbank | null;
  finais: { syncpay?: string; pagbank?: string };
  pagbankPeloServidor: boolean;
};

let cache: { ate: number; valor: Pagamentos } | null = null;
export function esquecerPagamentos() { cache = null; }

function abrir<T>(cifrado?: string | null): T | null {
  if (!cifrado) return null;
  try { return JSON.parse(decifrar(cifrado)) as T; } catch { return null; }
}

export async function pagamentos(): Promise<Pagamentos> {
  if (cache && cache.ate > Date.now()) return cache.valor;
  const [{ data: segredos }, { data: cfg }] = await Promise.all([
    db().from("glam_segredos").select("chave,valor_cifrado,final").in("chave", ["syncpay", "pagbank"]),
    db().from("glam_config").select("valor").eq("chave", "pagamentos").maybeSingle(),
  ]);
  const linha = (c: string) => (segredos || []).find((s) => s.chave === c);
  const syncpay = abrir<CredSyncpay>(linha("syncpay")?.valor_cifrado);
  let pagbank = abrir<CredPagbank>(linha("pagbank")?.valor_cifrado);
  let pagbankPeloServidor = false;
  if (!pagbank && env.pagbankToken) { pagbank = { token: env.pagbankToken, ambiente: env.pagbankEnv }; pagbankPeloServidor = true; }

  const preferido: GatewayPix = (cfg?.valor as { pix_gateway?: string } | null)?.pix_gateway === "pagbank" ? "pagbank" : "syncpay";
  const disponivel = { syncpay: !!syncpay, pagbank: !!pagbank };
  const outro: GatewayPix = preferido === "syncpay" ? "pagbank" : "syncpay";
  const pix: Pagamentos["pix"] = disponivel[preferido] ? preferido : disponivel[outro] ? outro : "demo";

  const valor: Pagamentos = {
    pix, preferido, cartao: !!pagbank, demo: pix === "demo", syncpay, pagbank, pagbankPeloServidor,
    finais: { syncpay: linha("syncpay")?.final || undefined, pagbank: linha("pagbank")?.final || undefined },
  };
  cache = { ate: Date.now() + 30_000, valor };
  return valor;
}

const final = (s: string) => (s.length >= 8 ? s.slice(-4) : "");

export async function guardarCredencial(chave: "syncpay" | "pagbank", valor: CredSyncpay | CredPagbank, staffId: string) {
  const ref = chave === "syncpay" ? (valor as CredSyncpay).clientId : (valor as CredPagbank).token;
  const { error } = await db().from("glam_segredos").upsert({
    chave, valor_cifrado: cifrar(JSON.stringify(valor)), final: final(ref), atualizado_em: new Date().toISOString(), atualizado_por: staffId,
  });
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}

export async function removerCredencial(chave: "syncpay" | "pagbank") {
  const { error } = await db().from("glam_segredos").delete().eq("chave", chave);
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}

export async function salvarPreferenciaPix(pix_gateway: GatewayPix) {
  const { error } = await db().from("glam_config").upsert({ chave: "pagamentos", valor: { pix_gateway }, atualizado_em: new Date().toISOString() });
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}
