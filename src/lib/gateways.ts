import "server-only";
import { db } from "./supabase-admin";
import { cifrar, decifrar } from "./crypto";
import { env } from "./env";

/**
 * Pagamentos, configurados no painel (Configurações › Pagamentos).
 * - PagBank: Pix e cartão (único gateway).
 * - Cartão: pode ser ligado/desligado e ter uma taxa repassada ao cliente.
 * As credenciais ficam em glam_segredos, cifradas com AES-256-GCM (a chave nunca vai para o banco).
 */
export type CredPagbank = { token: string; ambiente: "sandbox" | "production" };

/** Limites da taxa do cartão (o servidor sempre revalida). */
export const TAXA_PCT_MAX = 30;
export const TAXA_FIXA_MAX_CENTAVOS = 5000;

export type TaxaCartao = { pct: number; fixaCentavos: number };

export type Pagamentos = {
  /** Quem gera o Pix agora ("demo" = PagBank não conectado, nada é cobrado). */
  pix: "pagbank" | "demo";
  demo: boolean;
  /** Chave "Cartão ligado" do painel. */
  cartaoLigado: boolean;
  /** Cartão realmente disponível: ligado e PagBank conectado. */
  cartao: boolean;
  taxaCartao: TaxaCartao;
  pagbank: CredPagbank | null;
  finalPagbank?: string;
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
    db().from("glam_segredos").select("chave,valor_cifrado,final").eq("chave", "pagbank"),
    db().from("glam_config").select("valor").eq("chave", "pagamentos").maybeSingle(),
  ]);
  const linha = (segredos || [])[0];
  let pagbank = abrir<CredPagbank>(linha?.valor_cifrado);
  let pagbankPeloServidor = false;
  if (!pagbank && env.pagbankToken) { pagbank = { token: env.pagbankToken, ambiente: env.pagbankEnv }; pagbankPeloServidor = true; }

  const c = (cfg?.valor || {}) as { cartao_ativo?: unknown; cartao_taxa_pct?: unknown; cartao_taxa_fixa_centavos?: unknown };
  const cartaoLigado = c.cartao_ativo !== false; // sem configuração salva = ligado, como sempre foi
  const taxaCartao: TaxaCartao = {
    pct: Math.round(limitar(c.cartao_taxa_pct, TAXA_PCT_MAX) * 100) / 100,
    fixaCentavos: Math.round(limitar(c.cartao_taxa_fixa_centavos, TAXA_FIXA_MAX_CENTAVOS)),
  };
  const pix: Pagamentos["pix"] = pagbank ? "pagbank" : "demo";

  const valor: Pagamentos = {
    pix, demo: pix === "demo", cartaoLigado, cartao: cartaoLigado && !!pagbank, taxaCartao,
    pagbank, pagbankPeloServidor, finalPagbank: linha?.final || undefined,
  };
  cache = { ate: Date.now() + 30_000, valor };
  return valor;
}

const final = (s: string) => (s.length >= 8 ? s.slice(-4) : "");

export async function guardarCredencial(chave: "pagbank" | "resend", valor: CredPagbank | { chave: string }, staffId: string) {
  const ref = chave === "resend" ? (valor as { chave: string }).chave : (valor as CredPagbank).token;
  const { error } = await db().from("glam_segredos").upsert({
    chave, valor_cifrado: cifrar(JSON.stringify(valor)), final: final(ref), atualizado_em: new Date().toISOString(), atualizado_por: staffId,
  });
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}

export async function removerCredencial(chave: "pagbank" | "resend") {
  const { error } = await db().from("glam_segredos").delete().eq("chave", chave);
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}

export async function salvarConfigCartao(ativo: boolean, taxa: TaxaCartao) {
  const { error } = await db().from("glam_config").upsert({
    chave: "pagamentos",
    valor: { cartao_ativo: ativo, cartao_taxa_pct: taxa.pct, cartao_taxa_fixa_centavos: taxa.fixaCentavos },
    atualizado_em: new Date().toISOString(),
  });
  esquecerPagamentos();
  if (error) throw new Error(error.message);
}
