import "server-only";
import { db } from "./supabase-admin";
import type { Festa, Lote, LoteVitrine, SetorVitrine } from "./tipos";

export async function festasPublicadas(): Promise<(Festa & { a_partir: number | null; esgotada: boolean; percentual: number | null })[]> {
  const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data: festas } = await db()
    .from("glam_festas")
    .select("*")
    .eq("status", "publicada")
    .gte("data_inicio", desde)
    .order("data_inicio");
  const out = [];
  for (const f of (festas || []) as Festa[]) {
    const setores = await setoresDaFesta(f.id);
    const precos = setores.map((s) => s.atual?.preco_centavos).filter((p): p is number => p != null);
    const percentual = f.mostrar_percentual ? await percentualVendido(f) : null;
    out.push({ ...f, a_partir: precos.length ? Math.min(...precos) : null, esgotada: precos.length === 0, percentual });
  }
  return out;
}

export async function festaPorSlug(slug: string): Promise<Festa | null> {
  const { data } = await db().from("glam_festas").select("*").eq("slug", slug).maybeSingle();
  return data as Festa | null;
}

export async function percentualVendido(f: Festa) {
  const { data } = await db().rpc("glam_festa_ocupada", { p_festa_id: f.id });
  return Math.min(100, Math.round(((data as number) / f.lotacao) * 100));
}

/** Monta a vitrine por setor aplicando a virada automática de lote por data/esgotamento. */
export async function setoresDaFesta(festaId: string): Promise<SetorVitrine[]> {
  const [{ data: lotes }, { data: status }] = await Promise.all([
    db().from("glam_lotes").select("*").eq("festa_id", festaId).eq("ativo", true).order("ordem"),
    db().rpc("glam_lotes_status", { p_festa_id: festaId }),
  ]);
  const ocup = new Map<string, number>((status || []).map((s: any) => [s.lote_id, s.ocupado]));
  const agora = Date.now();
  const porSetor = new Map<string, LoteVitrine[]>();
  for (const l of (lotes || []) as Lote[]) {
    const ocupado = ocup.get(l.id) || 0;
    const disponivel = Math.max(0, l.capacidade - ocupado);
    let situacao: LoteVitrine["situacao"] = "a_venda";
    if (l.fim_vendas && agora > +new Date(l.fim_vendas)) situacao = "encerrado";
    else if (disponivel <= 0) situacao = "esgotado";
    else if (l.inicio_vendas && agora < +new Date(l.inicio_vendas)) situacao = "em_breve";
    const lv: LoteVitrine = { ...l, ocupado, disponivel, situacao };
    if (!porSetor.has(l.setor)) porSetor.set(l.setor, []);
    porSetor.get(l.setor)!.push(lv);
  }
  const ordemSetor = ["pista", "meia", "vip", "backstage", "camarote", "mesa"];
  return [...porSetor.entries()]
    .sort((a, b) => (ordemSetor.indexOf(a[0]) + 99) % 99 - (ordemSetor.indexOf(b[0]) + 99) % 99)
    .map(([setor, ls]) => {
      const atual = ls.find((l) => l.situacao === "a_venda") || null;
      const proximo = ls.find((l) => l.situacao === "em_breve" && (!atual || l.ordem > atual.ordem)) || null;
      return { setor, atual, proximo, lotes: ls };
    });
}
