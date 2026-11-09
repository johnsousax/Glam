import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { sha256, tokenAleatorio } from "@/lib/crypto";
import { dispararN8n } from "@/lib/n8n";
import { configCasa } from "@/lib/config";
import { env } from "@/lib/env";
import { PedirAcesso, lerCorpo } from "@/lib/esquemas";
import { dentroDoLimite, ipDe, origemValida, respostaLimite, turnstileOk } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/** Envia por e-mail um link de acesso de 30 minutos (sem senha). Sempre responde "ok" para não expor quem comprou. */
export async function POST(req: Request) {
  if (!origemValida(req)) return NextResponse.json({ erro: "Requisição inválida." }, { status: 403 });
  const ip = ipDe(req.headers);
  if (!(await dentroDoLimite(`acesso:ip:${ip}`, 10, 3600))) return respostaLimite();
  const b = await lerCorpo(req, PedirAcesso, 8_000);
  if (!b) return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  if (b.site) return NextResponse.json({ ok: true }); // honeypot: finge que deu certo
  if (!(await turnstileOk(b.turnstile, ip))) return NextResponse.json({ erro: "Confirme que você não é um robô." }, { status: 400 });
  const email = b.email;
  // 3 links por e-mail a cada 15 min (resposta sempre igual, para não revelar quem comprou)
  if (!(await dentroDoLimite(`acesso:email:${email}`, 3, 900))) return NextResponse.json({ ok: true });

  const { count: tem } = await db().from("glam_ingressos").select("*", { count: "exact", head: true }).eq("email_titular", email.toLowerCase());
  if (!tem) return NextResponse.json({ ok: true });

  const token = tokenAleatorio(32);
  await db().from("glam_acessos").insert({ token_hash: sha256(token), email, expira_em: new Date(Date.now() + 30 * 60e3).toISOString() });
  const casa = await configCasa();
  const { data: cli } = await db().from("glam_clientes").select("whatsapp").eq("email", email).maybeSingle();
  await dispararN8n("acesso_link", {
    casa: { nome: casa.nome, email_remetente: casa.email_remetente, evolution_instancia: casa.evolution_instancia },
    email,
    whatsapp: cli?.whatsapp || null,
    link: `${env.siteUrl}/meus-ingressos/${token}`,
  }, email);
  return NextResponse.json({ ok: true });
}
