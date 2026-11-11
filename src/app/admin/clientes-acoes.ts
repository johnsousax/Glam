"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase-admin";
import { auditar, exigirStaff } from "@/lib/staff";
import { dentroDoLimite, falhaInterna } from "@/lib/seguranca";
import { configCasa } from "@/lib/config";
import { env } from "@/lib/env";
import { enviarLoteEmails } from "@/lib/email";
import { montarDisparo } from "@/lib/email-modelos";
import { tokenDescadastro } from "@/lib/descadastro";

type Estado = { ok?: boolean; erro?: string; msg?: string } | undefined;
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Público do disparo: clientes que não saíram da lista. */
async function publico(f: FormData) {
  const festa = txt(f, "festa_id") || null;
  const min = Math.max(0, Math.floor(Number(txt(f, "min_compras")) || 0));
  const { data, error } = await db().rpc("glam_clientes_resumo", { p_busca: null, p_min_compras: min, p_festa_id: festa, p_so_marketing: true, p_limite: 20000 });
  if (error) throw new Error(error.message);
  return { lista: (data || []) as { id: string; nome: string; email: string }[], filtros: { festa_id: festa, min_compras: min } };
}

export async function contarPublico(f: FormData) {
  await exigirStaff("clientes");
  return (await publico(f)).lista.length;
}

export async function enviarDisparo(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("clientes");
  if (!(await dentroDoLimite(`disparo:${staff.id}`, 5, 3600))) return { erro: "Limite de disparos por hora atingido. Tente mais tarde." };
  const assunto = txt(f, "assunto").slice(0, 120);
  const mensagem = txt(f, "mensagem").slice(0, 5000);
  const botaoUrl = txt(f, "botao_url");
  if (assunto.length < 3 || mensagem.length < 5) return { erro: "Escreva o assunto e a mensagem." };
  if (botaoUrl && !/^https:\/\/[^\s]+$/.test(botaoUrl)) return { erro: "O link do botão precisa começar com https://" };
  try {
    const { lista, filtros } = await publico(f);
    if (!lista.length) return { erro: "Nenhum cliente nesse público." };
    const { data: d } = await db().from("glam_disparos").insert({ assunto, mensagem, publico: filtros, total: lista.length, criado_por: staff.id }).select("id").single();
    const casa = await configCasa();
    const msgs = lista.map((c) => {
      const sair = `${env.siteUrl}/descadastrar?t=${tokenDescadastro(c.id)}`;
      return { para: c.email, assunto, sair, html: montarDisparo(assunto, mensagem, c.nome, sair, env.siteUrl, botaoUrl || `${env.siteUrl}/`, botaoUrl ? txt(f, "botao_texto") || "Saiba mais" : "Ver festas") };
    });
    const r = await enviarLoteEmails(msgs, casa.email_remetente || "GLAM House <ingressos@glamhouse.site>");
    if (d) await db().from("glam_disparos").update({ enviados: r.enviados, falhas: r.falhas, status: r.enviados ? "concluido" : "falhou" }).eq("id", d.id);
    await auditar(staff, "disparo_enviado", "disparo", d?.id || "", { assunto, total: lista.length, enviados: r.enviados, falhas: r.falhas });
    revalidatePath("/admin/clientes");
    if (!r.enviados) return { erro: "Não foi possível enviar agora. Tente de novo em alguns minutos." };
    return { ok: true, msg: `Disparo enviado para ${r.enviados} cliente(s)${r.falhas ? ` · ${r.falhas} falharam` : ""}.` };
  } catch (e) {
    return { erro: falhaInterna("disparo", e).mensagem };
  }
}
