import "server-only";
import { redirect } from "next/navigation";
import { authClient } from "./supabase-server";
import { db } from "./supabase-admin";

export type Papel = "dono" | "gerente" | "financeiro" | "portaria";
export type Staff = { id: string; user_id: string; nome: string; email: string; papel: Papel; ativo: boolean };

/** O que cada nível de acesso pode ver/fazer (negar por padrão). */
export const PERMISSOES: Record<string, Papel[]> = {
  dashboard: ["dono", "gerente", "financeiro"],
  festas: ["dono", "gerente"],
  pedidos: ["dono", "gerente", "financeiro"],
  cancelar: ["dono", "gerente"],
  balcao: ["dono", "gerente"],
  cortesia: ["dono", "gerente"],
  lista: ["dono", "gerente", "portaria"],
  cupons: ["dono", "gerente"],
  promoters: ["dono", "gerente", "financeiro"],
  relatorios: ["dono", "gerente", "financeiro"],
  equipe: ["dono"],
  config: ["dono"],
  auditoria: ["dono", "financeiro"],
  portaria: ["dono", "gerente", "portaria"],
};

/** Níveis que obrigatoriamente usam verificação em 2 etapas. */
const MFA_OBRIGATORIO: Papel[] = ["dono", "gerente", "financeiro"];

export function pode(staff: Pick<Staff, "papel"> | null, recurso: keyof typeof PERMISSOES) {
  return !!staff && PERMISSOES[recurso].includes(staff.papel);
}

type Situacao = { staff: Staff | null; precisaMfa: boolean; semMfaCadastrado: boolean };

/** Staff logado + situação da verificação em 2 etapas. Qualquer erro = sem acesso (falha fechado). */
export async function staffAtual(): Promise<Situacao> {
  try {
    const sb = await authClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { staff: null, precisaMfa: false, semMfaCadastrado: false };
    const { data } = await db().from("glam_staff").select("*").eq("user_id", user.id).eq("ativo", true).maybeSingle();
    const staff = (data as Staff) || null;
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    const precisaMfa = !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
    const semMfaCadastrado = !!staff && MFA_OBRIGATORIO.includes(staff.papel) && aal?.nextLevel !== "aal2";
    return { staff, precisaMfa, semMfaCadastrado };
  } catch {
    return { staff: null, precisaMfa: false, semMfaCadastrado: false };
  }
}

export async function exigirStaff(recurso?: keyof typeof PERMISSOES, opcoes: { permitirSemMfa?: boolean } = {}): Promise<Staff> {
  const { staff, precisaMfa, semMfaCadastrado } = await staffAtual();
  if (!staff) redirect("/admin/login");
  if (precisaMfa) redirect("/admin/login?etapa=mfa");
  if (semMfaCadastrado && !opcoes.permitirSemMfa) redirect("/admin/seguranca?obrigatorio=1");
  if (recurso && !pode(staff, recurso)) redirect(staff.papel === "portaria" ? "/portaria" : "/admin?sem_permissao=1");
  return staff;
}

/** Versão para route handlers: devolve null (→ 401/403) em vez de redirecionar. */
export async function staffDaApi(recurso?: keyof typeof PERMISSOES): Promise<Staff | null> {
  const { staff, precisaMfa, semMfaCadastrado } = await staffAtual();
  if (!staff || precisaMfa || semMfaCadastrado) return null;
  if (recurso && !pode(staff, recurso)) return null;
  return staff;
}

export async function auditar(staff: Staff | null, acao: string, entidade?: string, entidadeId?: string, detalhes?: unknown) {
  await db().from("glam_auditoria").insert({
    staff_id: staff?.id ?? null, staff_nome: staff?.nome ?? "sistema", acao, entidade, entidade_id: entidadeId, detalhes: detalhes ?? null,
  });
}
