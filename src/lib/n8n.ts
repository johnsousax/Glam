import "server-only";
import { after } from "next/server";
import { env } from "./env";
import { db } from "./supabase-admin";
import { iguaisSeguro } from "./seguranca";
import { enviarEmailsDoEvento } from "./email";
import { enviarIngressosWhatsapp } from "./whatsapp";

export type EventoGlam =
  | "pedido_pago"
  | "acesso_link"
  | "ingresso_transferido"
  | "lote_esgotado"
  | "pedido_cancelado"
  | "alerta_seguranca"
  | "pix_lembrete"
  | "e_hoje"
  | "relatorio"
  | "backup"
  | "config";

/** Envia um evento para o fluxo "GLAM | Eventos do site" no n8n. Nunca derruba a requisição. */
export async function dispararN8n(evento: EventoGlam, dados: Record<string, unknown>, referencia?: string, opcoes?: { esperarWhatsapp?: boolean }) {
  let status = "enviado";
  let erro: string | undefined;
  if (evento === "pedido_pago") {
    // Pedido pago não passa mais pelo n8n de eventos: e-mail e WhatsApp (com PDFs) saem do site.
  } else if (!env.n8nWebhookUrl) {
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
  // E-mail sai direto pelo site; no pedido pago, os PDFs também vão pelo WhatsApp da casa
  if (evento === "pedido_pago") {
    // WhatsApp (texto + PDFs) leva alguns segundos: no fluxo normal roda depois da resposta,
    // para não atrasar o webhook do pagamento; no reenvio manual o painel espera o resultado.
    const zap = () => enviarIngressosWhatsapp(dados, referencia);
    if (opcoes?.esperarWhatsapp) await Promise.all([enviarEmailsDoEvento(evento, dados, referencia), zap()]);
    else {
      try { after(zap); } catch { void zap(); }
      await enviarEmailsDoEvento(evento, dados, referencia);
    }
  } else if (evento !== "config") await enviarEmailsDoEvento(evento, dados, referencia);
  return status;
}

/** Valida chamadas vindas do n8n. */
export function automacaoAutorizada(req: Request) {
  return env.automacaoSecret.length >= 32 && iguaisSeguro(req.headers.get("x-glam-secret"), env.automacaoSecret);
}
