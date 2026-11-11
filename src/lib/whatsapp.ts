import "server-only";
import { db } from "./supabase-admin";
import { env } from "./env";
import { pdfsDoPedido } from "./ingresso-pdf";

/**
 * WhatsApp da casa (instância "glam" na Evolution, via fluxo "GLAM | Conexão do WhatsApp" no n8n).
 * O número que envia é o celular conectado em Configurações › WhatsApp.
 */
type Envio = { acao: "enviar_texto" | "enviar_documento"; para: string; texto?: string; base64?: string; arquivo?: string };

async function enviar(e: Envio): Promise<{ ok: boolean; erro?: string }> {
  const url = process.env.N8N_WHATSAPP_URL;
  if (!url) return { ok: false, erro: "sem_whatsapp" };
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e), signal: AbortSignal.timeout(40000), cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
    return { ok: !!j.ok, erro: j.ok ? undefined : String(j.erro || `HTTP ${r.status}`).slice(0, 300) };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

/** Só números com DDI 55 (12 ou 13 dígitos). */
export function numeroZap(v: unknown) {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length === 12 || d.length === 13 ? d : "";
}

/** Pedido pago (e reenvio): mensagem curta + um PDF por pessoa, igual ao e-mail. Nunca derruba a requisição. */
export async function enviarIngressosWhatsapp(dados: Record<string, any>, referencia?: string) {
  const para = numeroZap(dados.cliente?.whatsapp);
  if (!para) return "sem_numero";
  try {
    const f = dados.festa || {};
    const nome = String(dados.cliente?.nome || "").split(" ")[0];
    const onde = [f.local || "GLAM House", f.endereco].filter(Boolean).join(" — ");
    const texto = `Oi, ${nome}! Seu pagamento foi aprovado e seus ingressos estão garantidos ✨\n\n*${f.titulo}*\n${f.data} · ${f.hora}\n${onde}`;
    const t = await enviar({ acao: "enviar_texto", para, texto });
    let falhas = t.ok ? 0 : 1, erro = t.erro || "";
    if (t.ok) {
      for (const p of await pdfsDoPedido(dados, env.siteUrl)) {
        const r = await enviar({ acao: "enviar_documento", para, base64: p.base64, arquivo: p.nome, texto: `Ingresso de ${p.pessoa} · ${p.lote}` });
        if (!r.ok) { falhas++; erro = r.erro || erro; }
      }
    }
    const status = falhas ? "falhou" : "enviado";
    await db().from("glam_notificacoes").insert({ evento: "whatsapp_pedido_pago", referencia, status, detalhes: falhas ? { erro } : null });
    return status;
  } catch (e) {
    try { await db().from("glam_notificacoes").insert({ evento: "whatsapp_pedido_pago", referencia, status: "falhou", detalhes: { erro: e instanceof Error ? e.message : String(e) } }); } catch {}
    return "falhou";
  }
}
