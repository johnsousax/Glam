import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { sha256, tokenAleatorio } from "@/lib/crypto";
import { dispararN8n } from "@/lib/n8n";
import { configCasa } from "@/lib/config";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Envia por e-mail um link de acesso de 30 minutos (sem senha). Sempre responde "ok" para não expor quem comprou. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });

  // Limite simples: 3 links por e-mail a cada 15 min
  const desde = new Date(Date.now() - 15 * 60e3).toISOString();
  const { count } = await db().from("glam_acessos").select("*", { count: "exact", head: true }).eq("email", email).gte("criado_em", desde);
  if ((count || 0) >= 3) return NextResponse.json({ ok: true });

  const { count: tem } = await db().from("glam_ingressos").select("*", { count: "exact", head: true }).ilike("email_titular", email);
  if (!tem) return NextResponse.json({ ok: true });

  const token = tokenAleatorio(32);
  await db().from("glam_acessos").insert({ token_hash: sha256(token), email, expira_em: new Date(Date.now() + 30 * 60e3).toISOString() });
  const casa = await configCasa();
  await dispararN8n("acesso_link", {
    casa: { nome: casa.nome, email_remetente: casa.email_remetente },
    email,
    link: `${env.siteUrl}/meus-ingressos/${token}`,
  }, email);
  return NextResponse.json({ ok: true });
}
