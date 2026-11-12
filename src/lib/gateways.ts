import "server-only";
import { db } from "./supabase-admin";
import { cifrar, decifrar } from "./crypto";
import { env } from "./env";

/**
 * Pagamentos, configurados no painel (Configurações › Pagamentos).
 * - Pix: SyncPay ou PagBank (escolhido no painel; se o escolhido não estiver conectado, usa o outro).
 * - Cartão: só PagBank; pode ser ligado/desligado e ter uma taxa repassada ao cliente.
 * As credenciais ficam em glam_segredos, cifradas com AES-256-GCM (a chave nunca vai para o banco).
 */
export type GatewayPix = "syncpay" | "pagbank";
export type CredSyncpay = { clientId: string; clientSecret: string };
export type CredPagbank = { token: string; ambiente: "sandbox" | "production" };

/** Limites da taxa do cartão (o servidor sempre revalida). */
export const TAXA_PCT_MAX = 30;
export const TAXA_FIXA_MAX_CENTAVOS = 5000;

export type TaxaCartao = { pct: number; fixaCentavos: number };

export type Pagamentos = {
  /** Quem gera o Pix agora ("demo" = nenhum gateway conectado, nada é cobrado). */
  pix: GatewayPix | "demo";
  /** Gateway de Pix escolhido no painel. */
  preferido: GatewayPix;
  demo: boolean;
  /** Chave "Cartão ligado" do painel. */
  cartaoLigado: boolean;
  /** Cartão realmente disponível: ligado e PagBank conectado. */
  cartao: boolean;
  taxaCartao: TaxaCartao;
  syncpay: CredSyncpay | null;
  pagbank: CredPagbank | null;
  finalPagbank?: string;
  finalSyncpay?: string;
  pagbankPeloServidor: boolean;
};

let cache: { ate: number; valor: Pagamentos } | null = null;
export function esquecerPagamentos() { cache = null; }

function abrir<T>(cifrado?: string | null): T | null {
  if (!cifrado) return null;
  try { return JSON.parse(decifrar(cifrado)) as T; } catch { return null; }
}

/** Taxa em centavos para um total: % sobre o valor + valor fixo, arredondada. */
export function calcularTaxaCartao(totalCentavos: number, t: TaxaCartao): number {
  if (!(totalCentavos > 0)) return 0;
  return Math.max(0, Math.round((totalCentavos * t.pct) / 100) + t.fixaCentavos);
}

function limitar(n: unknown, max: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0;
}

export async function pagamentos(): Promise<Pagamentos> {
  if (cache && cache.ate > Date.now()) return cache.valor;
  const [{ data: segredos }, { data: cfg }] = await Promise.all([
    db().from("glam_segredos").select("chave,valor_cifrado,final").in("chave", ["syncpay", "pagbank"]),
    db().from("glam_config").select("valor").eq("chave", "pagamentos").maybeSingle(),
  ]);
  const linhaDe = (k: string) => (segredos || []).find((x) => x.chave === k);
  const linha = linhaDe("pagbank");
  const syncpay = abrir<CredSyncpay>(linhaDe("syncpay")?.valor_cifrado);
  let pagbank = abrir<CredPagbank>(linha?.valor_cifrado);
  let pagbankPeloServidor = false;
  if (!pagbank && env.pagbankToken) { pagbank = { token: env.pagbankToken, ambiente: env.pagbankEnv }; pagbankPeloServidor = true; }

  const c = (cfg?.valor || {}) as { pix_gateway?: unknown; cartao_ativo?: unknown; cartao_taxa_pct?: unknown; cartao_taxa_fixa_centavos?: unknown };
  const cartaoLigado = c.cartao_ativo !== false; // sem configuração salva = ligado, como sempre foi
  const taxaCartao: TaxaCartao = {
    pct: Math.round(limitar(c.cartao_taxa_pct, TAXA_PCT_MAX) * 100) / 100,
    fixaCentavos: Math.round(limitar(c.cartao_taxa_fixa_centavos, TAXA_FIXA_MAX_CENTAVOS)),
  };
  const preferido: GatewayPix = c.pix_gateway === "pagbank" ? "pagbank" : "syncpay";
  const tem = { syncpay: !!syncpay, pagbank: !!pagbank };
  const outro: GatewayPix = preferido === "syncpay" ? "pagbank" : "syncpay";
  const pix: Pagamentos["pix"] = tem[preferido] ? preferido : tem[outro] ? outro : "demo";

  const valor: Pagamentos = {
    pix, preferido, demo: pix === "demo", syncpay, finalSyncpay: linhaDe("syncpay")?.final || undefined, cartaoLigado, cartao: cartaoLigado && !!pagbank, taxaCartao,
    pagbank, pagbankPeloServidor, finalPagbank: linha?.final || undefined,
  };
  cache = { ate: Date.now() + 30_000, valor };
  return valor;
}

const final = (s: string) => (s.length >= 8 ? s.slice(-4) : "");

export async function guardarCredencial(chave: "syncpay" | "pagbank" | "resend", valor: CredSyncpay | CredPagbank | { chave: string }, staffId: string) {
  const ref = chave === "syncpay" ? (valor as CredSyncpay).clientId : chave === "resend" ? (valor as { chave: string }).chave : (valor as CredPagbank).token;
  const { error } = await db().from("glam_segredos").upsert({
    chave, valor_cifrado: cifrar(JSON.stringify(valor)), final: final(ref), atualizado_em: new Date().toISOString(), atualizado_por: staffId,
  });
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}

export async function removerCredencial(chave: "syncpay" | "pagbank" | "resend") {
  const { error } = await db().from("glam_segredos").delete().eq("chave", chave);
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}

/** Junta as mudanças com o que já está salvo (gateway do Pix e cartão moram na mesma linha). */
async function salvarConfigPagamentos(mudanca: Record<string, unknown>) {
  const { data } = await db().from("glam_config").select("valor").eq("chave", "pagamentos").maybeSingle();
  const { error } = await db().from("glam_config").upsert({
    chave: "pagamentos", valor: { ...((data?.valor as object) || {}), ...mudanca }, atualizado_em: new Date().toISOString(),
  });
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}

export async function salvarConfigCartao(ativo: boolean, taxa: TaxaCartao) {
  await salvarConfigPagamentos({ cartao_ativo: ativo, cartao_taxa_pct: taxa.pct, cartao_taxa_fixa_centavos: taxa.fixaCentavos });
}

export async function salvarPreferenciaPix(pix_gateway: GatewayPix) {
  await salvarConfigPagamentos({ pix_gateway });
}
