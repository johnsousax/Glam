"use server";
import { revalidatePath } from "next/cache";
import { auditar, exigirStaff } from "@/lib/staff";
import { guardarCredencial, pagamentos, removerCredencial, salvarPreferenciaPix } from "@/lib/gateways";
import { tokenSyncpay } from "@/lib/syncpay";
import { enviarEmail, esquecerChaveEmail } from "@/lib/email";
import { configCasa } from "@/lib/config";
import { dentroDoLimite, falhaInterna } from "@/lib/seguranca";

type Estado = { ok?: boolean; erro?: string; msg?: string } | undefined;
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** SyncPay: testa as credenciais na própria SyncPay antes de guardar (cifradas). */
export async function salvarSyncpay(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("config");
  if (!(await dentroDoLimite(`gateway:${staff.id}`, 10, 900))) return { erro: "Muitas tentativas. Aguarde alguns minutos." };
  const clientId = txt(f, "client_id"), clientSecret = txt(f, "client_secret");
  if (clientId.length < 8 || clientId.length > 200 || clientSecret.length < 8 || clientSecret.length > 300) return { erro: "Cole o Client ID e o Client Secret da SyncPay." };
  try {
    await tokenSyncpay({ clientId, clientSecret }, true);
  } catch {
    return { erro: "A SyncPay recusou essas credenciais. Confira se copiou o Client ID e o Client Secret certos e se a chave de API está ativa." };
  }
  try {
    await guardarCredencial("syncpay", { clientId, clientSecret }, staff.id);
  } catch (e) { return { erro: falhaInterna("painel", e).mensagem }; }
  await auditar(staff, "gateway_alterado", "config", "syncpay");
  revalidatePath("/admin/config");
  return { ok: true, msg: "SyncPay conectada. O Pix do site já sai por ela." };
}

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
  return { ok: true, msg: "PagBank conectado. O cartão já aparece no site." };
}

export async function escolherPix(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("config");
  const g = txt(f, "pix_gateway") === "pagbank" ? "pagbank" : "syncpay";
  const pg = await pagamentos();
  if (!pg[g]) return { erro: `Conecte ${g === "syncpay" ? "a SyncPay" : "o PagBank"} antes de escolher.` };
  try { await salvarPreferenciaPix(g); } catch (e) { return { erro: falhaInterna("painel", e).mensagem }; }
  await auditar(staff, "gateway_alterado", "config", "pix", { pix_gateway: g });
  revalidatePath("/admin/config");
  return { ok: true, msg: `O Pix agora é recebido pel${g === "syncpay" ? "a SyncPay" : "o PagBank"}.` };
}

export async function desconectarGateway(f: FormData) {
  const staff = await exigirStaff("config");
  const v = txt(f, "gateway");
  const g = v === "pagbank" ? "pagbank" : v === "resend" ? "resend" : "syncpay";
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
