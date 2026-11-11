import "server-only";
import { db } from "./supabase-admin";
import { SETORES } from "./format";

/** Números do relatório (uma festa ou várias somadas). Tudo em centavos/contagens. */
export type Numeros = {
  bruto: number; sitePix: number; siteCartao: number; balcao: number; estornos: number; liquido: number; ticketMedio: number;
  capacidade: number; pagos: number; cortesias: number; emitidos: number; disponiveis: number; cancelados: number;
  entraram: number; naoEntraram: number; lista: number; listaEntraram: number;
  pedidosPagos: number; pedidosPerdidos: number; reembolsos: number;
};
export type LinhaLote = { nome: string; pagos: number; cortesias: number; faturado: number };
export type LinhaFesta = { titulo: string; data: string; ingressos: number; entraram: number; faturado: number };
export type Relatorio = {
  tipo: "festa" | "geral";
  titulo: string;
  data_inicio?: string;
  periodo?: { de?: string; ate?: string };
  n: Numeros;
  lotes: LinhaLote[];
  festas: LinhaFesta[];
};

const PAGINA = 1000;
/** Busca tudo (o Supabase devolve no máximo 1000 linhas por vez). */
async function todos<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGINA) return out;
  }
}

type Pedido = { id: string; festa_id: string; status: string; canal: string; metodo: string | null; total_centavos: number };
type Ingresso = { festa_id: string; lote_id: string; status: string; checkin_em: string | null; pedido_id: string };

function calcular(festaIds: string[], capacidade: number, pedidos: Pedido[], ingressos: Ingresso[], lista: { festa_id: string; checkin_em: string | null }[]) {
  const ids = new Set(festaIds);
  const ps = pedidos.filter((p) => ids.has(p.festa_id));
  const pago = ps.filter((p) => p.status === "pago");
  const reemb = ps.filter((p) => p.status === "reembolsado");
  const soma = (l: Pedido[]) => l.reduce((t, p) => t + (p.total_centavos || 0), 0);
  const cortesiaPed = new Set(pago.filter((p) => p.canal === "cortesia" || !p.total_centavos).map((p) => p.id));
  const pagoIds = new Set(pago.map((p) => p.id));
  const ing = ingressos.filter((i) => ids.has(i.festa_id));
  const ativos = ing.filter((i) => i.status === "ativo" && pagoIds.has(i.pedido_id));
  const bruto = soma(pago) + soma(reemb);
  const estornos = soma(reemb);
  const comValor = pago.filter((p) => p.total_centavos > 0);
  const cortesias = ativos.filter((i) => cortesiaPed.has(i.pedido_id)).length;
  const emitidos = ativos.length;
  const entraram = ativos.filter((i) => i.checkin_em).length;
  const ls = lista.filter((l) => ids.has(l.festa_id));
  const n: Numeros = {
    bruto, estornos, liquido: bruto - estornos,
    sitePix: soma(pago.filter((p) => p.canal === "site" && p.metodo === "pix")),
    siteCartao: soma(pago.filter((p) => p.canal === "site" && p.metodo === "cartao")),
    balcao: soma(pago.filter((p) => p.canal === "balcao")),
    ticketMedio: comValor.length ? Math.round(soma(comValor) / comValor.length) : 0,
    capacidade, pagos: emitidos - cortesias, cortesias, emitidos,
    disponiveis: Math.max(0, capacidade - emitidos),
    cancelados: ing.filter((i) => i.status === "cancelado").length,
    entraram, naoEntraram: emitidos - entraram,
    lista: ls.length, listaEntraram: ls.filter((l) => l.checkin_em).length,
    pedidosPagos: pago.length,
    pedidosPerdidos: ps.filter((p) => p.status === "expirado" || p.status === "cancelado").length,
    reembolsos: reemb.length,
  };
  return { n, ativos, cortesiaPed, pago };
}

async function carregar(festaIds: string[]) {
  if (!festaIds.length) return { pedidos: [] as Pedido[], ingressos: [] as Ingresso[], lista: [] as { festa_id: string; checkin_em: string | null }[] };
  const [pedidos, ingressos, lista] = await Promise.all([
    todos<Pedido>((de, ate) => db().from("glam_pedidos").select("id,festa_id,status,canal,metodo,total_centavos").in("festa_id", festaIds).neq("status", "pendente").order("id").range(de, ate)),
    todos<Ingresso>((de, ate) => db().from("glam_ingressos").select("festa_id,lote_id,status,checkin_em,pedido_id").in("festa_id", festaIds).order("id").range(de, ate)),
    todos<{ festa_id: string; checkin_em: string | null }>((de, ate) => db().from("glam_lista").select("festa_id,checkin_em").in("festa_id", festaIds).order("id").range(de, ate)),
  ]);
  return { pedidos, ingressos, lista };
}

export async function relatorioFesta(festaId: string): Promise<Relatorio | null> {
  const { data: f } = await db().from("glam_festas").select("id,titulo,data_inicio,lotacao").eq("id", festaId).maybeSingle();
  if (!f) return null;
  const [{ pedidos, ingressos, lista }, { data: lotes }] = await Promise.all([
    carregar([f.id]),
    db().from("glam_lotes").select("id,nome,setor,preco_centavos").eq("festa_id", f.id).order("setor").order("ordem"),
  ]);
  const { n, ativos, cortesiaPed } = calcular([f.id], f.lotacao, pedidos, ingressos, lista);
  // Faturado por lote: valor real pago, rateado pelos ingressos de cada pedido (respeita cupons)
  const porPedido = new Map<string, number>();
  for (const i of ativos) porPedido.set(i.pedido_id, (porPedido.get(i.pedido_id) || 0) + 1);
  const valorPedido = new Map(pedidos.map((p) => [p.id, p.total_centavos]));
  const linhas: LinhaLote[] = ((lotes || []) as any[]).map((l) => {
    const doLote = ativos.filter((i) => i.lote_id === l.id);
    const cort = doLote.filter((i) => cortesiaPed.has(i.pedido_id)).length;
    const faturado = doLote.reduce((t, i) => t + Math.round((valorPedido.get(i.pedido_id) || 0) / (porPedido.get(i.pedido_id) || 1)), 0);
    const setor = SETORES[l.setor] || l.setor;
    return { nome: setor && setor !== "Pista" ? `${setor} · ${l.nome}` : l.nome, pagos: doLote.length - cort, cortesias: cort, faturado };
  });
  return { tipo: "festa", titulo: f.titulo, data_inicio: f.data_inicio, n, lotes: linhas, festas: [] };
}

/** Relatório geral: soma das festas que acontecem no período (todas, se não houver período). */
export async function relatorioGeral(de?: string, ate?: string): Promise<Relatorio> {
  let q = db().from("glam_festas").select("id,titulo,data_inicio,lotacao,status").neq("status", "rascunho").order("data_inicio", { ascending: false }).limit(500);
  if (de) q = q.gte("data_inicio", `${de}T00:00:00-03:00`);
  if (ate) q = q.lte("data_inicio", `${ate}T23:59:59-03:00`);
  const { data } = await q;
  const festas = (data || []) as { id: string; titulo: string; data_inicio: string; lotacao: number; status: string }[];
  const contam = festas.filter((f) => f.status !== "cancelada");
  const { pedidos, ingressos, lista } = await carregar(festas.map((f) => f.id));
  const { n } = calcular(festas.map((f) => f.id), contam.reduce((t, f) => t + f.lotacao, 0), pedidos, ingressos, lista);
  const linhas: LinhaFesta[] = festas.map((f) => {
    const c = calcular([f.id], f.lotacao, pedidos, ingressos, lista).n;
    return { titulo: f.titulo, data: f.data_inicio, ingressos: c.emitidos, entraram: c.entraram, faturado: c.liquido };
  });
  return { tipo: "geral", titulo: de || ate ? "Relatório do período" : "Todas as festas", periodo: { de, ate }, n, lotes: [], festas: linhas };
}
