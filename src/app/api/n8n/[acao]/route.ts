import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { automacaoAutorizada, dispararN8n } from "@/lib/n8n";
import { configCasa } from "@/lib/config";
import { env } from "@/lib/env";
import { brl, dataLonga, hora, SETORES } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/**
 * Rotinas agendadas no banco (pg_cron + pg_net, cabeçalho x-glam-secret obrigatório).
 * Cada uma marca o que já foi feito (não repete) e manda os avisos prontos para o n8n.
 */
export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  return GET(req, ctx);
}

export async function GET(req: Request, { params }: { params: Promise<{ acao: string }> }) {
  if (!automacaoAutorizada(req)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const { acao } = await params;
  const casa = await configCasa();
  const casaInfo = { nome: casa.nome, whatsapp: casa.whatsapp_casa, whatsapp_dono: casa.whatsapp_dono, email_dono: casa.email_dono, email_remetente: casa.email_remetente, evolution_instancia: casa.evolution_instancia, endereco: casa.endereco };

  // 1) Quem gerou o Pix e ainda não pagou (entre 4 e 13 minutos)
  if (acao === "pix-pendentes") {
    const agora = Date.now();
    const { data } = await db().from("glam_pedidos")
      .select("id,codigo,total_centavos,expira_em, cliente:glam_clientes(nome,email,whatsapp), festa:glam_festas(titulo)")
      .eq("status", "pendente").not("pix_copia_cola", "is", null).is("lembrete_pix_enviado_em", null)
      .lte("criado_em", new Date(agora - 4 * 60e3).toISOString())
      .gte("expira_em", new Date(agora + 60e3).toISOString())
      .limit(100);
    const itens = (data || []) as any[];
    if (itens.length) await db().from("glam_pedidos").update({ lembrete_pix_enviado_em: new Date().toISOString() }).in("id", itens.map((p) => p.id));
    for (const p of itens) {
      await dispararN8n("pix_lembrete", {
        casa: casaInfo,
        codigo: p.codigo, total_fmt: brl(p.total_centavos), festa: p.festa.titulo, cliente: p.cliente,
        minutos_restantes: Math.max(1, Math.round((+new Date(p.expira_em) - agora) / 60e3)), url: `${env.siteUrl}/pedido/${p.id}`,
      }, p.codigo);
    }
    return NextResponse.json({ acao, enviados: itens.length });
  }

  // 2) "É hoje": festas de hoje, um aviso por comprador (e-mail + WhatsApp)
  if (acao === "festas-hoje") {
    const ini = new Date(`${hojeSP()}T00:00:00-03:00`), fim = new Date(ini.getTime() + 864e5);
    const { data: festas } = await db().from("glam_festas").select("*").in("status", ["publicada", "inativa", "esgotada"]).is("lembrete_hoje_enviado_em", null)
      .gte("data_inicio", ini.toISOString()).lt("data_inicio", fim.toISOString());
    const itens: any[] = [];
    for (const f of (festas || []) as any[]) {
      const { data: ings } = await db().from("glam_ingressos")
        .select("codigo,nome_titular,email_titular,whatsapp_titular, lote:glam_lotes(nome,setor), pedido:glam_pedidos!inner(status)")
        .eq("festa_id", f.id).eq("status", "ativo").eq("pedido.status", "pago").is("checkin_em", null);
      const porEmail = new Map<string, any>();
      for (const i of (ings || []) as any[]) {
        const k = (i.email_titular || i.whatsapp_titular || i.codigo).toLowerCase();
        if (!porEmail.has(k)) porEmail.set(k, { nome: i.nome_titular, email: i.email_titular, whatsapp: i.whatsapp_titular, ingressos: [] });
        porEmail.get(k).ingressos.push({ nome: i.nome_titular, setor: SETORES[i.lote.setor] || i.lote.setor, lote: i.lote.nome, url: `${env.siteUrl}/ingresso/${i.codigo}`, qr_url: `${env.siteUrl}/api/qr/${i.codigo}` });
      }
      for (const d of porEmail.values()) itens.push({ ...d, festa: { titulo: f.titulo, data: dataLonga(f.data_inicio), hora: hora(f.data_inicio), local: f.local_nome, endereco: f.endereco || casa.endereco, cartaz_url: f.cartaz_url } });
      await db().from("glam_festas").update({ lembrete_hoje_enviado_em: new Date().toISOString() }).eq("id", f.id);
    }
    for (const d of itens) await dispararN8n("e_hoje", { casa: casaInfo, ...d }, d.email || d.whatsapp);
    return NextResponse.json({ acao, enviados: itens.length });
  }

  // 3) Relatório no dia seguinte: festas que aconteceram ontem
  if (acao === "pos-festa") {
    const hoje = new Date(`${hojeSP()}T00:00:00-03:00`), ontem = new Date(hoje.getTime() - 864e5);
    const { data: festas } = await db().from("glam_festas").select("id,titulo,data_inicio,lotacao").is("relatorio_enviado_em", null)
      .gte("data_inicio", ontem.toISOString()).lt("data_inicio", hoje.toISOString()).neq("status", "rascunho");
    const itens = [];
    for (const f of (festas || []) as any[]) {
      const [{ data: c }, { data: r }] = await Promise.all([
        db().rpc("glam_festa_contadores", { p_festa_id: f.id }),
        db().rpc("glam_resumo", { p_inicio: "2000-01-01T00:00:00Z", p_fim: new Date().toISOString(), p_festa_id: f.id }),
      ]);
      const cc = c as any, rr = r as any;
      itens.push({
        titulo: f.titulo, data: dataLonga(f.data_inicio), lotacao: f.lotacao,
        ingressos: cc.ingressos, entraram: cc.entraram, faltaram: cc.ingressos - cc.entraram, lista: cc.lista, lista_entraram: cc.lista_entraram,
        faturamento_fmt: brl(cc.faturamento), pix_fmt: brl(rr.pix), cartao_fmt: brl(rr.cartao), balcao_fmt: brl(rr.balcao), pedidos: rr.pedidos,
        relatorio_url: `${env.siteUrl}/admin/festas/${f.id}/relatorio`,
      });
      await db().from("glam_festas").update({ relatorio_enviado_em: new Date().toISOString(), status: "encerrada" }).eq("id", f.id);
    }
    for (const f of itens) await dispararN8n("relatorio", { casa: casaInfo, festa: f }, f.titulo);
    return NextResponse.json({ acao, enviados: itens.length });
  }

  // 4) Cópia de segurança diária (JSON com todas as tabelas glam_; CPF continua criptografado)
  if (acao === "backup") {
    const tabelas = ["glam_config", "glam_staff", "glam_festas", "glam_lotes", "glam_cupons", "glam_promoters", "glam_clientes", "glam_pedidos", "glam_pedido_itens", "glam_ingressos", "glam_lista", "glam_auditoria"];
    const dump: Record<string, unknown[]> = {};
    for (const t of tabelas) {
      const linhas: unknown[] = [];
      for (let de = 0; ; de += 1000) {
        const { data } = await db().from(t).select("*").range(de, de + 999);
        linhas.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      dump[t] = linhas;
    }
    const json = JSON.stringify({ gerado_em: new Date().toISOString(), tabelas: dump });
    const resumo = Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length]));
    await dispararN8n("backup", { casa: casaInfo, arquivo: `glam-backup-${hojeSP()}.json`, base64: Buffer.from(json).toString("base64"), resumo }, "backup");
    return NextResponse.json({ acao, resumo });
  }

  // 5) Configuração para o n8n (WhatsApp do dono e instância) — usada pelo alerta de site fora do ar
  if (acao === "config") {
    await dispararN8n("config", { casa: casaInfo }, "config");
    return NextResponse.json({ acao, ok: true });
  }

  return NextResponse.json({ erro: "Ação desconhecida" }, { status: 404 });
}
