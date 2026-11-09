import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase-admin";
import { sha256 } from "@/lib/crypto";
import { lerCorpo } from "@/lib/esquemas";
import { dentroDoLimite, ipDe, origemValida, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

const Pedido = z.strictObject({ token: z.string().min(20).max(100), acao: z.enum(["exportar", "excluir"]) });

/** Direitos do titular (LGPD): exportar ou excluir os próprios dados, autenticado pelo link de acesso do e-mail. */
export async function POST(req: Request) {
  if (!origemValida(req)) return NextResponse.json({ erro: "Requisição inválida." }, { status: 403 });
  if (!(await dentroDoLimite(`dados:${ipDe(req.headers)}`, 10, 3600))) return respostaLimite();
  const b = await lerCorpo(req, Pedido, 2_000);
  if (!b) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  const { data: acesso } = await db().from("glam_acessos").select("email,expira_em").eq("token_hash", sha256(b.token)).maybeSingle();
  if (!acesso || new Date(acesso.expira_em) < new Date()) return NextResponse.json({ erro: "Link expirado. Peça um novo em Meus ingressos." }, { status: 401 });
  const email = acesso.email.toLowerCase();

  const { data: cliente } = await db().from("glam_clientes").select("id,nome,email,whatsapp,cpf_cifrado,criado_em").eq("email", email).maybeSingle();
  const { data: ingressos } = await db().from("glam_ingressos").select("id,codigo,nome_titular,status,checkin_em,criado_em, festa:glam_festas(titulo,data_inicio)").eq("email_titular", email.toLowerCase());

  if (b.acao === "exportar") {
    const { data: pedidos } = cliente
      ? await db().from("glam_pedidos").select("codigo,status,metodo,total_centavos,criado_em,pago_em, festa:glam_festas(titulo)").eq("cliente_id", cliente.id)
      : { data: [] };
    const conteudo = {
      gerado_em: new Date().toISOString(),
      titular: cliente ? { nome: cliente.nome, email: cliente.email, whatsapp: cliente.whatsapp, cpf: cliente.cpf_cifrado ? "guardado criptografado (não exibido por segurança)" : null, cadastro: cliente.criado_em } : { email },
      pedidos: pedidos || [],
      ingressos: (ingressos || []).map((i: any) => ({ nome: i.nome_titular, festa: i.festa?.titulo, data: i.festa?.data_inicio, situacao: i.status, entrada: i.checkin_em })),
    };
    return new NextResponse(JSON.stringify(conteudo, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="meus-dados-glam.json"' },
    });
  }

  // Excluir: não apaga ingresso de festa que ainda vai acontecer (a pessoa perderia a entrada)
  const futuros = (ingressos || []).filter((i: any) => i.status === "ativo" && !i.checkin_em && new Date(i.festa?.data_inicio) > new Date());
  if (futuros.length) return NextResponse.json({ erro: `Você tem ${futuros.length} ingresso(s) para festas futuras. Exclua os dados depois da festa ou transfira os ingressos.` }, { status: 409 });
  const anonimo = `removido+${crypto.randomUUID()}@glam.local`;
  if (cliente) {
    await db().from("glam_clientes").update({ nome: "Titular removido", email: anonimo, whatsapp: null, cpf_cifrado: null, cpf_hash: null, atualizado_em: new Date().toISOString() }).eq("id", cliente.id);
  }
  await db().from("glam_ingressos").update({ nome_titular: "Titular removido", email_titular: null, whatsapp_titular: null }).eq("email_titular", email.toLowerCase());
  await db().from("glam_acessos").update({ expira_em: new Date().toISOString() }).eq("email", email);
  await db().from("glam_auditoria").insert({ staff_nome: "titular", acao: "dados_excluidos_lgpd", entidade: "cliente", entidade_id: cliente?.id || null });
  return NextResponse.json({ ok: true });
}
