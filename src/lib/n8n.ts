import "server-only";
import { env } from "./env";
import { db } from "./supabase-admin";

export type EventoGlam =
  | "pedido_pago"
  | "acesso_link"
  | "ingresso_transferido"
  | "lote_esgotado"
  | "pedido_cancelado";

/** Envia um evento para o fluxo "GLAM | Eventos do site" no n8n. Nunca derruba a requisição. */
export async function dispararN8n(evento: EventoGlam, dados: Record<string, unknown>, referencia?: string) {
  let status = "enviado";
  let erro: string | undefined;
  if (!env.n8nWebhookUrl) {
    status = "sem_n8n";
  } else {
    try {
      const r = await fetch(env.n8nWebhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-glam-secret": env.automacaoSecret },
        body: JSON.stringify({ evento, enviado_em: new Date().toISOString(), site_url: env.siteUrl, ...dados }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        status = "falhou";
        erro = `HTTP ${r.status}`;
      }
    } catch (e) {
      status = "falhou";
      erro = e instanceof Error ? e.message : String(e);
    }
  }
  try {
    await db().from("glam_notificacoes").insert({ evento, referencia, status, detalhes: erro ? { erro } : null });
  } catch {}
  return status;
}

/** Valida chamadas vindas do n8n. */
export function automacaoAutorizada(req: Request) {
  return !!env.automacaoSecret && req.headers.get("x-glam-secret") === env.automacaoSecret;
}
