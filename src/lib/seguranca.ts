import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "./supabase-admin";
import { env } from "./env";

/** Comparação em tempo constante (segredos, tokens, assinaturas). */
export function iguaisSeguro(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y) && a.length === b.length;
}

/** IP real do visitante (Vercel coloca no x-forwarded-for / x-real-ip). */
export function ipDe(h: Headers) {
  return (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "sem-ip").trim().slice(0, 64);
}
export async function ipAtual() {
  return ipDe(await headers());
}

/**
 * Limite de tentativas por chave (janela fixa, guardado no Postgres).
 * Falha FECHADO: se o banco não responder, bloqueia.
 */
export async function dentroDoLimite(chave: string, max: number, janelaSeg: number) {
  try {
    const { data, error } = await db().rpc("glam_limite", { p_chave: chave.slice(0, 200), p_max: max, p_janela_seg: janelaSeg });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export function respostaLimite() {
  return NextResponse.json({ erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }, { status: 429 });
}

/** Proteção CSRF para POSTs do navegador: Origin precisa ser o próprio site. */
export function origemValida(req: Request) {
  const origem = req.headers.get("origin");
  if (!origem) return false;
  try {
    const o = new URL(origem);
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const site = new URL(env.siteUrl);
    return o.host === host || o.host === site.host;
  } catch {
    return false;
  }
}

/** Erro genérico com código de rastreio (detalhe só no log do servidor). */
export function falhaInterna(contexto: string, e: unknown) {
  const ref = randomBytes(4).toString("hex").toUpperCase();
  console.error(JSON.stringify({ nivel: "erro", contexto, ref, mensagem: e instanceof Error ? e.message : String(e) }));
  return { ref, mensagem: `Não foi possível concluir agora. Código: ${ref}` };
}

/** Log estruturado de evento de segurança (sem dado sensível). */
export function logSeguranca(evento: string, dados: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ nivel: "seguranca", evento, em: new Date().toISOString(), ...dados }));
}

/** Cloudflare Turnstile (opcional): só é exigido se as chaves estiverem configuradas. */
export async function turnstileOk(token: string | null | undefined, ip: string) {
  const segredo = process.env.TURNSTILE_SECRET_KEY;
  if (!segredo) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: segredo, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    return j.success === true;
  } catch {
    return false;
  }
}

/** Máscara de dados pessoais para telas e logs. */
export function mascararEmail(e: string | null | undefined) {
  if (!e) return "";
  const [u, d] = e.split("@");
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}
