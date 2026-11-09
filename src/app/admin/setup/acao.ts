"use server";
import { db } from "@/lib/supabase-admin";

export async function criarDono(_: unknown, f: FormData): Promise<{ erro?: string; ok?: boolean }> {
  const { count } = await db().from("glam_staff").select("*", { count: "exact", head: true });
  if (count) return { erro: "O painel já foi configurado." };
  const nome = String(f.get("nome") || "").trim();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const senha = String(f.get("senha") || "");
  if (!nome || !email) return { erro: "Preencha nome e e-mail." };
  if (senha.length < 10) return { erro: "Use uma senha com pelo menos 10 caracteres." };
  let userId: string | undefined;
  const { data, error } = await db().auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome, sistema: "glam" } });
  userId = data?.user?.id;
  if (error) {
    const { data: lista } = await db().auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = lista?.users.find((x) => x.email?.toLowerCase() === email);
    if (!u) return { erro: error.message };
    userId = u.id;
    await db().auth.admin.updateUserById(u.id, { password: senha });
  }
  const { error: e2 } = await db().from("glam_staff").insert({ user_id: userId, nome, email, papel: "dono" });
  if (e2) return { erro: e2.message };
  await db().from("glam_auditoria").insert({ staff_nome: nome, acao: "painel_configurado", entidade: "staff", entidade_id: email });
  return { ok: true };
}
