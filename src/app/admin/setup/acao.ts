"use server";
import { db } from "@/lib/supabase-admin";
import { dentroDoLimite, iguaisSeguro, ipAtual, senhaVazada } from "@/lib/seguranca";

export async function criarDono(_: unknown, f: FormData): Promise<{ erro?: string; ok?: boolean }> {
  const ip = await ipAtual();
  if (!(await dentroDoLimite(`setup:${ip}`, 5, 3600))) return { erro: "Muitas tentativas." };
  const tokenEsperado = process.env.GLAM_SETUP_TOKEN || "";
  if (tokenEsperado.length < 24 || !iguaisSeguro(String(f.get("token") || ""), tokenEsperado)) return { erro: "Código de instalação inválido." };
  const { count } = await db().from("glam_staff").select("*", { count: "exact", head: true });
  if (count) return { erro: "O painel já foi configurado." };
  const nome = String(f.get("nome") || "").trim().slice(0, 80);
  const email = String(f.get("email") || "").trim().toLowerCase().slice(0, 160);
  const senha = String(f.get("senha") || "");
  if (nome.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) return { erro: "Preencha nome e e-mail." };
  if (senha.length < 12 || senha.length > 128) return { erro: "Use uma senha de 12 a 128 caracteres." };
  if (await senhaVazada(senha)) return { erro: "Essa senha já apareceu em vazamentos na internet. Escolha outra." };
  const { data, error } = await db().auth.admin.createUser({ email, password: senha, email_confirm: true, app_metadata: { sistema: "glam" } });
  if (error || !data.user) return { erro: "Não foi possível criar a conta com esse e-mail. Use um e-mail exclusivo para a GLAM." };
  const { error: e2 } = await db().from("glam_staff").insert({ user_id: data.user.id, nome, email, papel: "dono" });
  if (e2) return { erro: "Falha ao registrar o dono." };
  await db().from("glam_auditoria").insert({ staff_nome: nome, acao: "painel_configurado", entidade: "staff", entidade_id: email, detalhes: { ip } });
  return { ok: true };
}
