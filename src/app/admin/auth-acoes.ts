"use server";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase-server";
import { db } from "@/lib/supabase-admin";
import { dentroDoLimite, ipAtual, logSeguranca, turnstileOk } from "@/lib/seguranca";
import { dispararN8n } from "@/lib/n8n";
import { configCasa } from "@/lib/config";

type Estado = { erro?: string; etapa?: "mfa"; ok?: boolean; msg?: string } | undefined;
const NEUTRA = "E-mail ou senha inválidos.";

async function alertar(texto: string) {
  const casa = await configCasa();
  await dispararN8n("alerta_seguranca", { casa: { whatsapp_dono: casa.whatsapp_dono, email_dono: casa.email_dono, email_remetente: casa.email_remetente, evolution_instancia: casa.evolution_instancia }, texto }, "seguranca");
}

export async function entrar(_: Estado, f: FormData): Promise<Estado> {
  const email = String(f.get("email") || "").trim().toLowerCase().slice(0, 160);
  const senha = String(f.get("senha") || "").slice(0, 200);
  const ip = await ipAtual();
  if (!(await dentroDoLimite(`login:ip:${ip}`, 10, 900))) return { erro: "Muitas tentativas. Aguarde 15 minutos." };
  if (!(await dentroDoLimite(`login:conta:${email}`, 5, 900))) {
    if (await dentroDoLimite(`alerta:conta:${email}`, 1, 900)) await alertar(`🚨 Várias tentativas de login erradas no painel GLAM para ${email} (IP ${ip}). A conta foi travada por 15 min.`);
    logSeguranca("login_bloqueado", { email, ip });
    return { erro: "Muitas tentativas. Aguarde 15 minutos." };
  }
  if (!(await turnstileOk(String(f.get("cf-turnstile-response") || ""), ip))) return { erro: "Confirme que você não é um robô." };
  if (!email || !senha) return { erro: NEUTRA };

  const sb = await authClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) { logSeguranca("login_falhou", { email, ip }); return { erro: NEUTRA }; }

  // Só quem está na equipe GLAM entra (o Auth é compartilhado com outros sistemas)
  const { data: staff } = await db().from("glam_staff").select("id,nome,papel").eq("user_id", data.user.id).eq("ativo", true).maybeSingle();
  if (!staff) { await sb.auth.signOut(); logSeguranca("login_sem_acesso", { email, ip }); return { erro: NEUTRA }; }

  await db().from("glam_auditoria").insert({ staff_id: staff.id, staff_nome: staff.nome, acao: "login", entidade: "staff", entidade_id: staff.id, detalhes: { ip } });
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return { etapa: "mfa" };
  redirect(staff.papel === "portaria" ? "/portaria" : "/admin");
}

export async function verificarMfa(_: Estado, f: FormData): Promise<Estado> {
  const codigo = String(f.get("codigo") || "").replace(/\D/g, "").slice(0, 6);
  const ip = await ipAtual();
  const sb = await authClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");
  if (!(await dentroDoLimite(`mfa:${user.id}`, 5, 900))) {
    if (await dentroDoLimite(`alerta:mfa:${user.id}`, 1, 900)) await alertar(`🚨 Muitos códigos de verificação errados no painel GLAM (${user.email}, IP ${ip}).`);
    return { erro: "Muitas tentativas. Aguarde 15 minutos.", etapa: "mfa" };
  }
  const { data: fatores } = await sb.auth.mfa.listFactors();
  const totp = fatores?.totp?.find((x) => x.status === "verified");
  if (!totp) return { erro: "Nenhum autenticador cadastrado.", etapa: "mfa" };
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: totp.id, code: codigo });
  if (error) { logSeguranca("mfa_falhou", { user: user.id, ip }); return { erro: "Código inválido.", etapa: "mfa" }; }
  const { data: staff } = await db().from("glam_staff").select("papel").eq("user_id", user.id).maybeSingle();
  redirect(staff?.papel === "portaria" ? "/portaria" : "/admin");
}

export async function sair() {
  const sb = await authClient();
  await sb.auth.signOut();
  redirect("/admin/login");
}

// ---------- Minha segurança ----------
export type NovoMfa = { id: string; qr: string; segredo: string } | { erro: string };

export async function iniciarMfa(): Promise<NovoMfa> {
  const sb = await authClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { erro: "Sessão expirada." };
  // Limpa tentativas antigas não confirmadas
  const { data: fatores } = await sb.auth.mfa.listFactors();
  for (const x of fatores?.all || []) if (x.status !== "verified") await sb.auth.mfa.unenroll({ factorId: x.id });
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `GLAM ${new Date().toISOString().slice(0, 10)}`, issuer: "GLAM House" });
  if (error || !data) return { erro: "Não foi possível iniciar. Tente de novo." };
  return { id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}

export async function confirmarMfa(_: Estado, f: FormData): Promise<Estado> {
  const sb = await authClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { erro: "Sessão expirada." };
  if (!(await dentroDoLimite(`mfa-cad:${user.id}`, 10, 900))) return { erro: "Muitas tentativas." };
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: String(f.get("factorId")), code: String(f.get("codigo") || "").replace(/\D/g, "") });
  if (error) return { erro: "Código inválido." };
  await db().from("glam_auditoria").insert({ staff_nome: user.email, acao: "mfa_ativado", entidade: "staff", entidade_id: user.id });
  return { ok: true, msg: "Verificação em 2 etapas ativada." };
}

export async function trocarSenha(_: Estado, f: FormData): Promise<Estado> {
  const atual = String(f.get("atual") || "");
  const nova = String(f.get("nova") || "");
  if (nova.length < 12 || nova.length > 128) return { erro: "A nova senha precisa ter de 12 a 128 caracteres." };
  if (nova !== String(f.get("repetir") || "")) return { erro: "As senhas não conferem." };
  const sb = await authClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada." };
  if (!(await dentroDoLimite(`senha:${user.id}`, 5, 900))) return { erro: "Muitas tentativas." };
  // Reautenticação: confirma a senha atual antes de trocar
  const { createClient } = await import("@supabase/supabase-js");
  const verif = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error: e1 } = await verif.auth.signInWithPassword({ email: user.email, password: atual });
  if (e1) return { erro: "Senha atual incorreta." };
  await verif.auth.signOut();
  const { error } = await sb.auth.updateUser({ password: nova });
  if (error) return { erro: "Não foi possível trocar (senha fraca ou já vazada? Tente outra)." };
  await sb.auth.signOut({ scope: "others" });
  await db().from("glam_auditoria").insert({ staff_nome: user.email, acao: "senha_trocada", entidade: "staff", entidade_id: user.id });
  return { ok: true, msg: "Senha alterada. As outras sessões foram encerradas." };
}
