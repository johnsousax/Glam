"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase-admin";
import { auditar, exigirStaff } from "@/lib/staff";
import { localParaIso, slugify } from "@/lib/format";
import { salvarCliente } from "@/lib/clientes";
import { confirmarPagamento, payloadNotificacao, traduzirErro } from "@/lib/pedidos";
import { dispararN8n } from "@/lib/n8n";
import { falhaInterna } from "@/lib/seguranca";
import sharp from "sharp";

export type Estado = { ok?: boolean; erro?: string; msg?: string } | undefined;

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, padrao = 0) => { const v = Number(String(f.get(k) ?? "").replace(",", ".")); return Number.isFinite(v) ? v : padrao; };
const reais = (f: FormData, k: string) => Math.round(num(f, k) * 100);
const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";


// ---------------- Festas ----------------
async function subirCartaz(arquivo: File | null) {
  if (!arquivo || arquivo.size === 0) return null;
  if (arquivo.size > 5 * 1024 * 1024) throw new Error("Cartaz acima de 5 MB.");
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!jpg && !png && !webp) throw new Error("Cartaz inválido: use JPG, PNG ou WEBP.");
  // Reprocessa a imagem no servidor: remove EXIF/GPS e qualquer conteúdo escondido
  let limpo: Buffer;
  try {
    limpo = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  } catch {
    throw new Error("Cartaz inválido: não foi possível ler a imagem.");
  }
  const caminho = `${new Date().getFullYear()}/${crypto.randomUUID()}.webp`;
  const { error } = await db().storage.from("glam-cartazes").upload(caminho, limpo, { contentType: "image/webp", upsert: false });
  if (error) throw new Error("Falha no upload do cartaz.");
  return db().storage.from("glam-cartazes").getPublicUrl(caminho).data.publicUrl;
}

export async function salvarFesta(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("festas");
  const id = txt(f, "id");
  try {
    const cartaz = await subirCartaz(f.get("cartaz") as File | null);
    const titulo = txt(f, "titulo");
    if (!titulo) return { erro: "Informe o título." };
    const inicio = localParaIso(txt(f, "data_inicio"));
    if (!inicio) return { erro: "Informe a data e hora." };
    const dados: Record<string, unknown> = {
      titulo,
      subtitulo: txt(f, "subtitulo") || null,
      descricao: txt(f, "descricao") || null,
      data_inicio: inicio,
      data_fim: localParaIso(txt(f, "data_fim")),
      local_nome: txt(f, "local_nome") || "GLAM House",
      endereco: txt(f, "endereco") || null,
      lotacao: Math.max(1, Math.floor(num(f, "lotacao", 500))),
      mostrar_percentual: bool(f, "mostrar_percentual"),
      classificacao: txt(f, "classificacao") || null,
      status: txt(f, "status") || "rascunho",
      atualizado_em: new Date().toISOString(),
    };
    if (cartaz) dados.cartaz_url = cartaz;
    if (id) {
      const { error } = await db().from("glam_festas").update(dados).eq("id", id);
      if (error) return { erro: falhaInterna("painel", error).mensagem };
      await auditar(staff, "festa_editada", "festa", id, { titulo, status: dados.status });
      revalidatePath(`/admin/festas/${id}`);
      return { ok: true, msg: "Festa salva." };
    }
    let slug = slugify(txt(f, "slug") || titulo);
    const { data: existe } = await db().from("glam_festas").select("id").eq("slug", slug).maybeSingle();
    if (existe) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db().from("glam_festas").insert({ ...dados, slug }).select("id").single();
    if (error) return { erro: falhaInterna("painel", error).mensagem };
    await auditar(staff, "festa_criada", "festa", data.id, { titulo });
    redirect(`/admin/festas/${data.id}?nova=1`);
  } catch (e) {
    if ((e as any)?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    return { erro: e instanceof Error && e.message.startsWith("Cartaz") ? e.message : falhaInterna("festa", e).mensagem };
  }
}

export async function salvarLote(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("festas");
  const id = txt(f, "id");
  const festaId = txt(f, "festa_id");
  const dados = {
    festa_id: festaId,
    setor: txt(f, "setor") || "pista",
    nome: txt(f, "nome"),
    descricao: txt(f, "descricao") || null,
    preco_centavos: reais(f, "preco"),
    capacidade: Math.max(0, Math.floor(num(f, "capacidade"))),
    pessoas_por_unidade: Math.max(1, Math.floor(num(f, "pessoas_por_unidade", 1))),
    max_por_pedido: Math.max(1, Math.floor(num(f, "max_por_pedido", 10))),
    ordem: Math.floor(num(f, "ordem", 1)),
    inicio_vendas: localParaIso(txt(f, "inicio_vendas")),
    fim_vendas: localParaIso(txt(f, "fim_vendas")),
    ativo: f.has("ativo") ? bool(f, "ativo") : true,
  };
  if (!dados.nome) return { erro: "Dê um nome ao lote (ex.: 1º lote)." };
  if (id) {
    const { data: antes } = await db().from("glam_lotes").select("preco_centavos,capacidade,nome").eq("id", id).single();
    const { error } = await db().from("glam_lotes").update({ ...dados, aviso_esgotado_em: null }).eq("id", id);
    if (error) return { erro: falhaInterna("painel", error).mensagem };
    if (antes && antes.preco_centavos !== dados.preco_centavos) {
      await auditar(staff, "preco_alterado", "lote", id, { lote: dados.nome, de: antes.preco_centavos, para: dados.preco_centavos });
    } else {
      await auditar(staff, "lote_editado", "lote", id, { lote: dados.nome, capacidade: dados.capacidade });
    }
  } else {
    const { data, error } = await db().from("glam_lotes").insert(dados).select("id").single();
    if (error) return { erro: falhaInterna("painel", error).mensagem };
    await auditar(staff, "lote_criado", "lote", data.id, { lote: dados.nome, preco: dados.preco_centavos });
  }
  revalidatePath(`/admin/festas/${festaId}`);
  return { ok: true, msg: "Lote salvo." };
}

export async function excluirLote(f: FormData) {
  const staff = await exigirStaff("festas");
  const id = txt(f, "id");
  const festaId = txt(f, "festa_id");
  const { count } = await db().from("glam_pedido_itens").select("*", { count: "exact", head: true }).eq("lote_id", id);
  if (count) await db().from("glam_lotes").update({ ativo: false }).eq("id", id);
  else await db().from("glam_lotes").delete().eq("id", id);
  await auditar(staff, count ? "lote_desativado" : "lote_excluido", "lote", id);
  revalidatePath(`/admin/festas/${festaId}`);
}

// ---------------- Lista de nomes ----------------
export async function adicionarLista(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("lista");
  const festaId = txt(f, "festa_id");
  const tipo = txt(f, "tipo") || "lista";
  const promoterId = txt(f, "promoter_id") || null;
  const nomes = txt(f, "nomes").split(/\r?\n|;/).map((n) => n.trim()).filter(Boolean).slice(0, 1000);
  if (!nomes.length) return { erro: "Cole ao menos um nome (um por linha)." };
  const { count } = await db().from("glam_lista").select("*", { count: "exact", head: true }).eq("festa_id", festaId);
  if ((count || 0) + nomes.length > 1000) return { erro: `A lista aceita até 1.000 nomes. Já existem ${count}.` };
  const { error } = await db().from("glam_lista").insert(nomes.map((nome) => ({ festa_id: festaId, nome: nome.slice(0, 80), tipo, promoter_id: promoterId, criado_por: staff.id })));
  if (error) return { erro: falhaInterna("painel", error).mensagem };
  await auditar(staff, tipo === "cortesia" ? "cortesia_lista" : "lista_adicionada", "festa", festaId, { quantidade: nomes.length, tipo });
  revalidatePath(`/admin/festas/${festaId}/lista`);
  return { ok: true, msg: `${nomes.length} nome(s) adicionados.` };
}

export async function removerLista(f: FormData) {
  const staff = await exigirStaff("lista");
  const id = txt(f, "id");
  const { data } = await db().from("glam_lista").delete().eq("id", id).select("festa_id,nome").single();
  await auditar(staff, "lista_removida", "lista", id, { nome: data?.nome });
  if (data) revalidatePath(`/admin/festas/${data.festa_id}/lista`);
}

export async function checkinLista(f: FormData) {
  const staff = await exigirStaff("lista");
  const id = txt(f, "id");
  const desfazer = txt(f, "desfazer") === "1";
  const { data } = await db().from("glam_lista").update(desfazer ? { checkin_em: null, checkin_por: null } : { checkin_em: new Date().toISOString(), checkin_por: staff.id }).eq("id", id).select("festa_id").single();
  if (data) revalidatePath(`/admin/festas/${data.festa_id}/lista`);
}

// ---------------- Pedidos ----------------
export async function cancelarPedido(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("cancelar");
  const id = txt(f, "id");
  const motivo = txt(f, "motivo");
  if (!motivo) return { erro: "Informe o motivo do cancelamento." };
  const { data: p } = await db().from("glam_pedidos").select("codigo,status,total_centavos,metodo").eq("id", id).single();
  if (!p || p.status === "cancelado") return { erro: "Pedido já cancelado." };
  await db().from("glam_pedidos").update({ status: "cancelado", cancelado_em: new Date().toISOString(), cancelado_por: staff.id, motivo_cancelamento: motivo }).eq("id", id);
  await db().from("glam_ingressos").update({ status: "cancelado" }).eq("pedido_id", id);
  await auditar(staff, "pedido_cancelado", "pedido", id, { codigo: p.codigo, motivo, valor: p.total_centavos, metodo: p.metodo, estado_anterior: p.status });
  revalidatePath("/admin/pedidos");
  return { ok: true, msg: p.status === "pago" && (p.metodo === "pix" || p.metodo === "cartao") ? "Cancelado. Faça o estorno no app do PagBank." : "Pedido cancelado." };
}

export async function reenviarIngressos(f: FormData) {
  const staff = await exigirStaff("pedidos");
  const id = txt(f, "id");
  const payload = await payloadNotificacao(id);
  if (payload) await dispararN8n("pedido_pago", { ...payload, reenvio: true }, payload.pedido.codigo);
  await auditar(staff, "ingressos_reenviados", "pedido", id);
  revalidatePath("/admin/pedidos");
}

export async function confirmarManual(f: FormData) {
  const staff = await exigirStaff("cancelar");
  const id = txt(f, "id");
  await confirmarPagamento(id, null, null);
  await auditar(staff, "pagamento_confirmado_manual", "pedido", id);
  revalidatePath("/admin/pedidos");
}

// ---------------- Balcão e cortesias ----------------
export async function vendaBalcao(_: Estado, f: FormData): Promise<Estado> {
  const metodo = txt(f, "metodo");
  const cortesia = metodo === "cortesia";
  const staff = await exigirStaff(cortesia ? "cortesia" : "balcao");
  const [flFesta, flLote] = txt(f, "festa_lote").split("|");
  const festaId = txt(f, "festa_id") || flFesta;
  const loteId = txt(f, "lote_id") || flLote;
  const quantidade = Math.max(1, Math.floor(num(f, "quantidade", 1)));
  const nome = txt(f, "nome");
  const email = txt(f, "email").toLowerCase();
  if (!festaId || !loteId) return { erro: "Escolha a festa e o lote." };
  if (nome.length < 3) return { erro: "Informe o nome do cliente." };
  const nomes = txt(f, "nomes").split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
  try {
    const clienteId = await salvarCliente({
      nome, email: email || `balcao+${Date.now()}@glam.local`, whatsapp: txt(f, "whatsapp") || null,
    });
    const { data, error } = await db().rpc("glam_criar_pedido_v2", {
      p_festa_id: festaId, p_cliente_id: clienteId,
      p_itens: [{ lote_id: loteId, quantidade, nomes: nomes.length ? nomes : [nome] }],
      p_cupom: null, p_promoter: txt(f, "promoter") || null,
      p_canal: cortesia ? "cortesia" : "balcao", p_metodo: metodo, p_staff_id: staff.id, p_ignorar_janela: true,
    });
    if (error) return { erro: traduzirErro(error.message) };
    const pedido = data as { id: string; codigo: string; total: number };
    if (cortesia) await db().from("glam_pedidos").update({ desconto_centavos: pedido.total, total_centavos: 0 }).eq("id", pedido.id);
    await confirmarPagamento(pedido.id, null, metodo);
    await auditar(staff, cortesia ? "cortesia_emitida" : "venda_balcao", "pedido", pedido.id, { codigo: pedido.codigo, quantidade, metodo, valor: cortesia ? 0 : pedido.total, cliente: nome });
    revalidatePath("/admin/pedidos");
    return { ok: true, msg: `Pedido ${pedido.codigo} emitido${email ? " e enviado ao cliente" : ""}.` };
  } catch (e) {
    return { erro: falhaInterna("balcao", e).mensagem };
  }
}

// ---------------- Cupons ----------------
export async function salvarCupom(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("cupons");
  const tipo = txt(f, "tipo") === "valor" ? "valor" : "percentual";
  const dados = {
    codigo: txt(f, "codigo").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32),
    festa_id: txt(f, "festa_id") || null,
    lote_id: txt(f, "lote_id") || null,
    tipo,
    valor: tipo === "valor" ? reais(f, "valor") : Math.min(100, Math.floor(num(f, "valor"))),
    usos_max: txt(f, "usos_max") ? Math.floor(num(f, "usos_max")) : null,
    limite_por_cliente: txt(f, "limite_por_cliente") ? Math.max(1, Math.floor(num(f, "limite_por_cliente"))) : null,
    valido_ate: localParaIso(txt(f, "valido_ate")),
    ativo: true,
  };
  if (!dados.codigo || dados.valor <= 0) return { erro: "Informe código e valor." };
  const { error } = await db().from("glam_cupons").insert(dados);
  if (error) return { erro: error.code === "23505" ? "Já existe um cupom com esse código." : falhaInterna("cupom", error).mensagem };
  await auditar(staff, "cupom_criado", "cupom", dados.codigo, dados);
  revalidatePath("/admin/cupons");
  return { ok: true, msg: "Cupom criado." };
}

export async function alternarCupom(f: FormData) {
  const staff = await exigirStaff("cupons");
  const id = txt(f, "id");
  const ativo = txt(f, "ativo") === "1";
  await db().from("glam_cupons").update({ ativo }).eq("id", id);
  await auditar(staff, ativo ? "cupom_ativado" : "cupom_desativado", "cupom", id);
  revalidatePath("/admin/cupons");
}

// ---------------- Promoters ----------------
export async function salvarPromoter(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("promoters");
  const id = txt(f, "id");
  const dados = {
    nome: txt(f, "nome"),
    codigo: slugify(txt(f, "codigo") || txt(f, "nome")).replace(/-/g, ""),
    whatsapp: txt(f, "whatsapp") || null,
    email: txt(f, "email") || null,
    comissao_percentual: num(f, "comissao", 10),
    ativo: f.has("ativo") ? bool(f, "ativo") : true,
  };
  if (!dados.nome) return { erro: "Informe o nome." };
  const { error } = id ? await db().from("glam_promoters").update(dados).eq("id", id) : await db().from("glam_promoters").insert(dados);
  if (error) return { erro: error.code === "23505" ? "Esse código de link já existe." : falhaInterna("promoter", error).mensagem };
  await auditar(staff, id ? "promoter_editado" : "promoter_criado", "promoter", id || dados.codigo, { nome: dados.nome, comissao: dados.comissao_percentual });
  revalidatePath("/admin/promoters");
  return { ok: true, msg: "Promoter salvo." };
}

// ---------------- Equipe ----------------
export async function salvarMembro(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("equipe");
  const email = txt(f, "email").toLowerCase();
  const nome = txt(f, "nome");
  const papel = txt(f, "papel");
  const senha = txt(f, "senha");
  if (!["dono", "gerente", "financeiro", "portaria"].includes(papel)) return { erro: "Nível inválido." };
  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (senha.length < 12 || senha.length > 128) return { erro: "Senha provisória com 12 a 128 caracteres." };
  const { data: existente } = await db().from("glam_staff").select("id").eq("email", email).maybeSingle();
  if (existente) return { erro: "Essa pessoa já está na equipe. Altere o nível na lista." };
  const { data: criado, error } = await db().auth.admin.createUser({ email, password: senha, email_confirm: true, app_metadata: { sistema: "glam" } });
  if (error || !criado?.user) return { erro: "Não foi possível criar o acesso com esse e-mail. Use um e-mail exclusivo para a GLAM." };
  const { error: e2 } = await db().from("glam_staff").insert({ user_id: criado.user.id, nome, email, papel, ativo: true });
  if (e2) return { erro: falhaInterna("painel", e2).mensagem };
  await auditar(staff, "membro_adicionado", "staff", email, { papel });
  revalidatePath("/admin/equipe");
  return { ok: true, msg: `${nome} pode entrar em /admin com a senha provisória e deve trocá-la em “Minha segurança”.` };
}

export async function alterarMembro(f: FormData) {
  const staff = await exigirStaff("equipe");
  const id = txt(f, "id");
  const papel = txt(f, "papel");
  const ativo = txt(f, "ativo");
  if (id === staff.id && (ativo === "0" || (papel && papel !== "dono"))) return; // não se tranca para fora
  const upd: Record<string, unknown> = {};
  if (papel) upd.papel = papel;
  if (ativo) upd.ativo = ativo === "1";
  // Bloqueio vale na hora: toda página e ação confere glam_staff.ativo a cada requisição
  await db().from("glam_staff").update(upd).eq("id", id);
  await auditar(staff, "membro_alterado", "staff", id, upd);
  revalidatePath("/admin/equipe");
}

// ---------------- Configurações ----------------
export async function salvarConfig(_: Estado, f: FormData): Promise<Estado> {
  const staff = await exigirStaff("config");
  const campos = ["nome", "slogan", "cidade", "endereco", "instagram", "whatsapp_casa", "whatsapp_dono", "email_dono", "email_remetente", "evolution_instancia"];
  const valor: Record<string, unknown> = {};
  for (const c of campos) valor[c] = txt(f, c);
  for (const c of ["whatsapp_casa", "whatsapp_dono"]) {
    let d = String(valor[c]).replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) d = "55" + d;
    valor[c] = d;
  }
  valor.comissao_padrao = num(f, "comissao_padrao", 10);
  const { error } = await db().from("glam_config").upsert({ chave: "casa", valor, atualizado_em: new Date().toISOString() });
  if (error) return { erro: falhaInterna("painel", error).mensagem };
  await auditar(staff, "config_alterada", "config", "casa");
  revalidatePath("/admin/config");
  return { ok: true, msg: "Configurações salvas." };
}
