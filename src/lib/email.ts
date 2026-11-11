import "server-only";
import { db } from "./supabase-admin";
import { env } from "./env";
import { decifrar } from "./crypto";
import { montarEmails, type EmailMontado } from "./email-modelos";
import { pdfsDoPedido } from "./ingresso-pdf";

/**
 * E-mails transacionais enviados direto pelo site (Resend).
 * A chave fica cifrada em glam_segredos ("resend"), cadastrada em Configurações › E-mail,
 * ou na variável RESEND_API_KEY.
 */
let cache: { ate: number; chave: string | null } | null = null;
export function esquecerChaveEmail() { cache = null; }

export async function chaveResend(): Promise<string | null> {
  if (cache && cache.ate > Date.now()) return cache.chave;
  let chave: string | null = process.env.RESEND_API_KEY || null;
  try {
    const { data } = await db().from("glam_segredos").select("valor_cifrado").eq("chave", "resend").maybeSingle();
    if (data?.valor_cifrado) chave = (JSON.parse(decifrar(data.valor_cifrado)) as { chave: string }).chave;
  } catch {}
  cache = { ate: Date.now() + 30_000, chave };
  return chave;
}

export async function enviarEmail(m: EmailMontado, remetente: string, chave?: string | null) {
  const k = chave ?? (await chaveResend());
  if (!k) return { ok: false, erro: "sem_chave" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: remetente, to: [m.para], subject: m.assunto, html: m.html,
      attachments: (m.anexos || []).map((a) => ({ filename: a.nome, content: a.base64, content_type: a.tipo })),
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return { ok: false, erro: `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}

/** Gera e envia os e-mails de um evento. No pedido pago, anexa um PDF por pessoa. Nunca derruba a requisição. */
export async function enviarEmailsDoEvento(evento: string, dados: Record<string, any>, referencia?: string) {
  try {
    const chave = await chaveResend();
    if (!chave) return "sem_chave";
    const corpo = { evento, site_url: env.siteUrl, ...dados };
    const emails = montarEmails(corpo, env.siteUrl);
    if (!emails.length) return "nada";

    if (evento === "pedido_pago" && Array.isArray(dados.ingressos)) {
      emails[0].anexos = (await pdfsDoPedido(dados, env.siteUrl)).map((p) => ({ nome: p.nome, base64: p.base64, tipo: "application/pdf" }));
    }

    const remetente = dados.casa?.email_remetente || "GLAM House <ingressos@glamhouse.site>";
    let falhas = 0, ultimoErro = "";
    for (const m of emails) {
      const r = await enviarEmail(m, remetente, chave);
      if (!r.ok) { falhas++; ultimoErro = r.erro || ""; }
    }
    const status = falhas ? "falhou" : "enviado";
    await db().from("glam_notificacoes").insert({ evento: `email_${evento}`, referencia, status, detalhes: falhas ? { erro: ultimoErro } : { emails: emails.length } });
    return status;
  } catch (e) {
    try { await db().from("glam_notificacoes").insert({ evento: `email_${evento}`, referencia, status: "falhou", detalhes: { erro: e instanceof Error ? e.message : String(e) } }); } catch {}
    return "falhou";
  }
}

/** Envio em lote (até 100 por chamada) — usado nos disparos de novidades. */
export async function enviarLoteEmails(mensagens: { para: string; assunto: string; html: string; sair: string }[], remetente: string) {
  const k = await chaveResend();
  if (!k) return { enviados: 0, falhas: mensagens.length, erro: "sem_chave" };
  let enviados = 0, falhas = 0, erro = "";
  for (let i = 0; i < mensagens.length; i += 100) {
    const parte = mensagens.slice(i, i + 100);
    try {
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${k}`, "content-type": "application/json" },
        body: JSON.stringify(parte.map((m) => ({
          from: remetente, to: [m.para], subject: m.assunto, html: m.html,
          headers: { "List-Unsubscribe": `<${m.sair}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }))),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) enviados += parte.length;
      else { falhas += parte.length; erro = `HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`; }
    } catch (e) { falhas += parte.length; erro = e instanceof Error ? e.message : String(e); }
  }
  return { enviados, falhas, erro };
}
