import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { setoresDaFesta } from "@/lib/festas";
import { env } from "@/lib/env";
import { brl, dataHora, SETORES } from "@/lib/format";
import { Kpi, Selo, Titulo } from "@/components/admin/Titulo";
import { Confirmar } from "@/components/admin/ui";
import { FecharJanela, SairPara } from "@/components/admin/Fechar";
import type { Festa } from "@/lib/tipos";
import { FestaForm } from "../FestaForm";
import { LoteForm } from "./LoteForm";
import { excluirLote } from "../../../acoes";

export const dynamic = "force-dynamic";

export default async function EditarFesta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string }> }) {
  await exigirStaff("festas");
  const { id } = await params;
  const { nova } = await searchParams;
  const { data: festa } = await db().from("glam_festas").select("*").eq("id", id).maybeSingle();
  if (!festa) notFound();
  const [{ data: lotes }, setores, { data: c }] = await Promise.all([
    db().from("glam_lotes").select("*").eq("festa_id", id).order("setor").order("ordem"),
    setoresDaFesta(id),
    db().rpc("glam_festa_contadores", { p_festa_id: id }),
  ]);
  const ocupacao = new Map<string, number>();
  setores.forEach((s) => s.lotes.forEach((l) => ocupacao.set(l.id, l.ocupado)));
  const atuais = new Set(setores.map((s) => s.atual?.id).filter(Boolean));
  const f = festa as Festa;

  return (
    <>
      <Titulo sup="Festa" titulo={f.titulo}>
        <a href={`${env.siteUrl}/festa/${f.slug}`} target="_blank" className="btn-linha">Ver no site ↗</a>
        <Link href={`/admin/festas/${id}/lista`} className="btn-linha">Lista de nomes</Link>
        <Link href={`/admin/festas/${id}/relatorio`} className="btn-linha">Relatório</Link>
        <a href={`/admin/relatorios/pdf?festa=${id}`} className="btn-linha">Relatório PDF</a>
        <Link href={`/portaria?festa=${id}`} className="btn-linha">Portaria</Link>
        <SairPara href="/admin/festas" rotulo="Voltar para as festas" />
      </Titulo>
      {nova && <p className="mb-6 rounded-lg border border-sucesso/40 bg-sucesso/10 px-4 py-2 text-sm text-sucesso">Festa criada! Agora cadastre os lotes. Ela já está como “Ativo” no site.</p>}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Ingressos vendidos" valor={String(c?.ingressos || 0)} sub={`${c?.ocupado || 0}/${f.lotacao} pessoas (com reservas)`} />
        <Kpi rotulo="Entraram" valor={String(c?.entraram || 0)} sub={`Lista: ${c?.lista_entraram || 0}/${c?.lista || 0}`} />
        <Kpi rotulo="Faltam entrar" valor={String((c?.ingressos || 0) - (c?.entraram || 0))} />
        <Kpi rotulo="Faturamento" valor={brl(c?.faturamento)} />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-fumaca">Lotes · virada automática por data e por esgotamento</h2>
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-[0.65rem] uppercase tracking-[0.2em] text-fumaca">
              <tr className="border-b border-linha"><th className="p-3">Setor</th><th>Lote</th><th>Preço</th><th>Vendidos</th><th>Janela</th><th>Situação</th><th></th></tr>
            </thead>
            <tbody>
              {(lotes || []).map((l: any) => (
                <tr key={l.id} className="border-b border-linha/60 align-top">
                  <td className="p-3">{SETORES[l.setor] || l.setor}{l.pessoas_por_unidade > 1 && <span className="text-fumaca"> ({l.pessoas_por_unidade}p)</span>}</td>
                  <td className="py-3">{l.nome} <span className="text-fumaca">#{l.ordem}</span></td>
                  <td className="py-3">{brl(l.preco_centavos)}</td>
                  <td className="py-3">{ocupacao.get(l.id) || 0}/{l.capacidade}</td>
                  <td className="py-3 text-xs text-fumaca">{l.inicio_vendas ? dataHora(l.inicio_vendas) : "—"} → {l.fim_vendas ? dataHora(l.fim_vendas) : "—"}</td>
                  <td className="py-3">{!l.ativo ? <Selo>inativo</Selo> : atuais.has(l.id) ? <Selo cor="sucesso">à venda</Selo> : (ocupacao.get(l.id) || 0) >= l.capacidade ? <Selo cor="perigo">esgotado</Selo> : <Selo cor="ouro">aguardando</Selo>}</td>
                  <td className="py-3 pr-3 text-right">
                    <details className="inline-block text-left">
                      <summary className="cursor-pointer text-xs text-ouro">Editar</summary>
                      <div className="fixed inset-x-4 top-20 z-40 max-h-[80vh] overflow-auto rounded-2xl border border-ouro/40 bg-carvao p-5 shadow-2xl lg:left-[290px]">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="font-display text-2xl">{l.nome}</p>
                          <FecharJanela />
                        </div>
                        <LoteForm festaId={id} lote={l} />
                        <form action={excluirLote} className="mt-4">
                          <input type="hidden" name="id" value={l.id} /><input type="hidden" name="festa_id" value={id} />
                          <Confirmar mensagem="Excluir este lote? (Se já tiver vendas, ele será apenas desativado.)" className="text-xs text-perigo underline">Excluir lote</Confirmar>
                        </form>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {(lotes || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-fumaca">Nenhum lote ainda.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="cartao mt-4 p-5">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-ouro">Novo lote</p>
          <LoteForm festaId={id} proximaOrdem={(lotes?.length || 0) + 1} />
          <p className="mt-3 text-xs text-fumaca">Dica: crie “1º lote”, “2º lote”… no mesmo setor com ordens 1, 2, 3. O site sempre vende o primeiro disponível; quando esgota ou passa a data de fim, o próximo entra sozinho.</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-fumaca">Dados da festa</h2>
        <FestaForm festa={f} />
      </section>
    </>
  );
}
