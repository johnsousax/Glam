"use server";
import { revalidatePath } from "next/cache";
import { auditar, exigirStaff } from "@/lib/staff";
import { guardarCredencial, removerCredencial, salvarConfigCartao, TAXA_FIXA_MAX_CENTAVOS, TAXA_PCT_MAX } from "@/lib/gateways";
import { brl } from "@/lib/format";
import { enviarEmail, esquecerChaveEmail } from "@/lib/email";
import { configCasa } from "@/lib/config";
import { dentroDoLimite, falhaInterna } from "@/lib/seguranca";

type Estado = { ok?: boolean; erro?: string; msg?: string } | undefined;
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** PagBank: valida o token pedindo a chave pública do cartão antes de guardar. */
export async function salvarPagbank(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("config");
  if (!(await dentroDoLimite(`gateway:${staff.id}`, 10, 900))) return { erro: "Muitas tentativas. Aguarde alguns minutos." };
  const token = txt(f, "token");
  const ambiente = txt(f, "ambiente") === "sandbox" ? "sandbox" : "production";
  if (token.length < 20 || token.length > 400) return { erro: "Cole o token do PagBank." };
  try {
    const base = ambiente === "production" ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com";
    const r = await fetch(`${base}/public-keys`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ type: "card" }), cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (r.status === 401 || r.status === 403) return { erro: "O PagBank recusou esse token. Confira o token e o ambiente (produção ou teste)." };
  } catch {
    return { erro: "Não foi possível falar com o PagBank agora. Tente de novo." };
  }
  try {
    await guardarCredencial("pagbank", { token, ambiente }, staff.id);
  } catch (e) { return { erro: falhaInterna("painel", e).mensagem }; }
  await auditar(staff, "gateway_alterado", "config", "pagbank", { ambiente });
  revalidatePath("/admin/config");
  return { ok: true, msg: "PagBank conectado. O Pix do site já sai por ele." };
}

/** Número digitado no painel ("4,99", "0.50", "R$ 1,50") → número, ou null se não for válido. */
function numero(v: string): number | null {
  const t = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Cartão: liga/desliga e define a taxa repassada ao cliente (% sobre o ingresso + valor fixo). */
export async function salvarCartao(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("config");
  const ativo = f.get("cartao_ativo") === "on";
  const pct = numero(txt(f, "taxa_pct")), fixa = numero(txt(f, "taxa_fixa"));
  if (pct === null || pct < 0 || pct > TAXA_PCT_MAX) return { erro: `A taxa em % precisa estar entre 0 e ${TAXA_PCT_MAX}.` };
  if (fixa === null || fixa < 0 || Math.round(fixa * 100) > TAXA_FIXA_MAX_CENTAVOS) return { erro: `O valor fixo precisa estar entre R$ 0,00 e ${brl(TAXA_FIXA_MAX_CENTAVOS)}.` };
  const taxa = { pct: Math.round(pct * 100) / 100, fixaCentavos: Math.round(fixa * 100) };
  try { await salvarConfigCartao(ativo, taxa); } catch (e) { return { erro: falhaInterna("painel", e).mensagem }; }
  await auditar(staff, "gateway_alterado", "config", "cartao", { ativo, taxa_pct: taxa.pct, taxa_fixa_centavos: taxa.fixaCentavos });
  revalidatePath("/admin/config");
  const quanto = taxa.pct || taxa.fixaCentavos ? ` Taxa: ${[taxa.pct ? `${String(taxa.pct).replace(".", ",")}%` : "", taxa.fixaCentavos ? brl(taxa.fixaCentavos) : ""].filter(Boolean).join(" + ")}.` : " Sem taxa.";
  return { ok: true, msg: ativo ? `Cartão ligado.${quanto}` : "Cartão desligado. O site só aceita Pix." };
}

export async function desconectarGateway(f: FormData) {
  const staff = await exigirStaff("config");
  const v = txt(f, "gateway");
  const g = v === "resend" ? "resend" : "pagbank";
  await removerCredencial(g);
  if (g === "resend") esquecerChaveEmail();
  await auditar(staff, "gateway_removido", "config", g);
  revalidatePath("/admin/config");
}

/** E-mail (Resend): guarda a chave cifrada e manda um e-mail de teste para quem salvou. */
export async function salvarResend(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("config");
  if (!(await dentroDoLimite(`gateway:${staff.id}`, 10, 900))) return { erro: "Muitas tentativas. Aguarde alguns minutos." };
  const chave = txt(f, "chave");
  if (!/^re_[A-Za-z0-9_]{10,200}$/.test(chave)) return { erro: "Cole a chave de API do Resend (começa com re_)." };
  const casa = await configCasa();
  const destino = staff.email || casa.email_dono;
  const teste = await enviarEmail({
    para: destino, assunto: "GLAM · e-mails ligados ✅",
    html: "<p>Pronto! Os ingressos e avisos da GLAM agora saem por este e-mail.</p>",
  }, casa.email_remetente || "GLAM House <ingressos@glamhouse.site>", chave);
  if (!teste.ok) return { erro: "O Resend recusou o envio de teste. Confira a chave e se o domínio do remetente (glamhouse.site) está verificado." };
  try { await guardarCredencial("resend", { chave }, staff.id); } catch (e) { return { erro: falhaInterna("painel", e).mensagem }; }
  esquecerChaveEmail();
  await auditar(staff, "gateway_alterado", "config", "resend");
  revalidatePath("/admin/config");
  return { ok: true, msg: `E-mail ligado. Mandei um teste para ${destino}.` };
}
