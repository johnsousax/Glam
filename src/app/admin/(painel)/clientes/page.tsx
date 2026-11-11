import Link from "next/link";
import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { brl, dataCurta } from "@/lib/format";
import { Kpi, Selo, Titulo } from "@/components/admin/Titulo";
import { Disparo } from "./Disparo";

export const dynamic = "force-dynamic";

type Linha = { id: string; nome: string; email: string; whatsapp: string | null; aceita_marketing: boolean; compras: number; ingressos: number; total_centavos: number; ultima_compra: string | null; festas: string[] };

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string; min?: string; festa?: string; novidades?: string }> }) {
  await exigirStaff("clientes");
  const sp = await searchParams;
  const busca = (sp.q || "").trim().slice(0, 80);
  const min = Math.max(0, Math.floor(Number(sp.min) || 0));
  const [{ data }, { data: todos }, { data: festas }, { data: disparos }] = await Promise.all([
    db().rpc("glam_clientes_resumo", { p_busca: busca || null, p_min_compras: min, p_festa_id: sp.festa || null, p_so_marketing: sp.novidades === "1", p_limite: 500 }),
    db().rpc("glam_clientes_resumo", { p_busca: null, p_min_compras: 0, p_festa_id: null, p_so_marketing: false, p_limite: 20000 }),
    db().from("glam_festas").select("id,titulo").order("data_inicio", { ascending: false }).limit(60),
    db().from("glam_disparos").select("assunto,total,enviados,falhas,status,criado_em").order("criado_em", { ascending: false }).limit(5),
  ]);
  const lista = (data || []) as Linha[];
  const base = (todos || []) as Linha[];
  const compradores = base.filter((c) => c.compras > 0);
  const recorrentes = base.filter((c) => c.compras >= 2).length;
  const aceitam = base.filter((c) => c.aceita_marketing).length;
  const csv = `/admin/clientes/csv?${new URLSearchParams({ q: busca, min: String(min), festa: sp.festa || "", novidades: sp.novidades || "" })}`;

  return (
    <>
      <Titulo sup="Relacionamento" titulo="Clientes"><a href={csv} className="btn-linha">Baixar planilha (CSV)</a></Titulo>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Clientes" valor={String(compradores.length)} sub={`${base.length} cadastrados`} />
        <Kpi rotulo="Voltaram (2+ compras)" valor={String(recorrentes)} sub={compradores.length ? `${Math.round((recorrentes / compradores.length) * 100)}% dos clientes` : undefined} />
        <Kpi rotulo="Aceitam novidades" valor={String(aceitam)} sub="Podem receber disparos" />
        <Kpi rotulo="Faturamento total" valor={brl(base.reduce((t, c) => t + Number(c.total_centavos), 0))} />
      </div>

      <form className="mb-4 grid gap-3 sm:grid-cols-5">
        <input name="q" defaultValue={busca} placeholder="Nome, e-mail ou WhatsApp" className="campo sm:col-span-2" />
        <select name="min" defaultValue={String(min)} className="campo">
          <option value="0">Qualquer nº de compras</option><option value="1">1+ compras</option><option value="2">2+ compras</option><option value="3">3+ compras</option><option value="5">5+ compras</option>
        </select>
        <select name="festa" defaultValue={sp.festa || ""} className="campo"><option value="">Qualquer festa</option>{(festas || []).map((f: any) => <option key={f.id} value={f.id}>Foi na {f.titulo}</option>)}</select>
        <select name="novidades" defaultValue={sp.novidades || ""} className="campo"><option value="">Todos</option><option value="1">Só quem aceita novidades</option></select>
        <button className="btn-linha sm:col-span-5 sm:w-fit">Filtrar</button>
      </form>

      <div className="cartao mb-8 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-fumaca"><tr className="border-b border-linha"><th className="p-3">Cliente</th><th>WhatsApp</th><th>Compras</th><th>Ingressos</th><th>Total gasto</th><th>Última compra</th><th>Novidades</th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className="border-b border-linha/60 hover:bg-marfim/5">
                <td className="p-3"><Link href={`/admin/clientes/${c.id}`} className="font-medium text-marfim underline-offset-2 hover:underline">{c.nome}</Link><p className="text-xs text-fumaca">{c.email}</p></td>
                <td className="text-fumaca">{c.whatsapp || "—"}</td>
                <td>{c.compras >= 2 ? <Selo cor="sucesso">{c.compras}×</Selo> : c.compras}</td>
                <td>{c.ingressos}</td>
                <td>{brl(Number(c.total_centavos))}</td>
                <td className="text-fumaca">{c.ultima_compra ? dataCurta(c.ultima_compra) : "—"}</td>
                <td>{c.aceita_marketing ? <Selo cor="sucesso">sim</Selo> : <span className="text-fumaca">não</span>}</td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-fumaca">Nenhum cliente encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <Disparo festas={(festas || []) as { id: string; titulo: string }[]} />

      {(disparos || []).length > 0 && (
        <section className="mt-6 max-w-3xl">
          <h2 className="mb-2 text-sm font-semibold">Últimos disparos</h2>
          <div className="cartao divide-y divide-linha">
            {(disparos || []).map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 truncate">{d.assunto}</span>
                <span className="shrink-0 text-xs text-fumaca">{dataCurta(d.criado_em)} · {d.enviados}/{d.total} enviados{d.falhas ? ` · ${d.falhas} falhas` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
