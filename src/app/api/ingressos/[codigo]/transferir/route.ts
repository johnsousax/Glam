import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { dispararN8n } from "@/lib/n8n";
import { configCasa } from "@/lib/config";
import { env } from "@/lib/env";
import { dataLonga, hora, normalizarWhatsapp } from "@/lib/format";
import { Transferir, lerCorpo } from "@/lib/esquemas";
import { dentroDoLimite, ipDe, iguaisSeguro, origemValida, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(codigo)) return NextResponse.json({ erro: "Ingresso inválido." }, { status: 400 });
  if (!origemValida(req)) return NextResponse.json({ erro: "Requisição inválida." }, { status: 403 });
  if (!(await dentroDoLimite(`transf:ip:${ipDe(req.headers)}`, 10, 3600)) || !(await dentroDoLimite(`transf:ing:${codigo}`, 5, 86400))) return respostaLimite();
  const b = await lerCorpo(req, Transferir, 8_000);
  if (!b) return NextResponse.json({ erro: "Preencha nome e e-mail de quem vai usar." }, { status: 400 });
  const nome = b.nome.slice(0, 80);
  const email = b.email;
  const emailAtual = b.email_atual;

  const { data: t } = await db()
    .from("glam_ingressos")
    .select("*, pedido:glam_pedidos(status, cliente:glam_clientes(email)), festa:glam_festas(titulo,data_inicio,local_nome,endereco), lote:glam_lotes(nome,setor)")
    .eq("codigo", codigo).maybeSingle();
  if (!t || t.status !== "ativo" || t.pedido?.status !== "pago") return NextResponse.json({ erro: "Ingresso inválido." }, { status: 404 });
  if (t.checkin_em) return NextResponse.json({ erro: "Este ingresso já foi usado." }, { status: 409 });
  const donos = [t.email_titular, t.pedido?.cliente?.email].filter(Boolean).map((e: string) => e.toLowerCase());
  if (!donos.some((d) => iguaisSeguro(d, emailAtual))) return NextResponse.json({ erro: "O e-mail não confere com o da compra." }, { status: 403 });
  if (t.transferencias >= 3) return NextResponse.json({ erro: "Limite de transferências atingido. Fale com a GLAM." }, { status: 409 });

  // Novo código: o QR antigo deixa de valer imediatamente
  const { data: novo } = await db().rpc("glam_gerar_codigo", { p_bytes: 18 });
  const { error } = await db().from("glam_ingressos").update({
    codigo: novo, nome_titular: nome, email_titular: email,
    whatsapp_titular: b.whatsapp ? normalizarWhatsapp(String(b.whatsapp)) : null,
    transferencias: t.transferencias + 1,
  }).eq("id", t.id).eq("codigo", codigo).is("checkin_em", null);
  if (error) return NextResponse.json({ erro: "Não foi possível transferir." }, { status: 500 });

  await db().from("glam_auditoria").insert({ staff_nome: "cliente", acao: "ingresso_transferido", entidade: "ingresso", entidade_id: t.id, detalhes: { de: t.nome_titular, para: nome } });
  const casa = await configCasa();
  await dispararN8n("ingresso_transferido", {
    casa: { nome: casa.nome, whatsapp: casa.whatsapp_casa, email_remetente: casa.email_remetente, evolution_instancia: casa.evolution_instancia },
    de: t.nome_titular,
    para: { nome, email, whatsapp: b.whatsapp ? normalizarWhatsapp(String(b.whatsapp)) : null },
    festa: { titulo: t.festa.titulo, data: dataLonga(t.festa.data_inicio), hora: hora(t.festa.data_inicio), local: t.festa.local_nome, endereco: t.festa.endereco },
    ingresso: { codigo: novo, setor: t.lote.setor, lote: t.lote.nome, url: `${env.siteUrl}/ingresso/${novo}`, qr_url: `${env.siteUrl}/api/qr/${novo}` },
  }, t.id);
  return NextResponse.json({ ok: true });
}
