import Link from "next/link";
import { db } from "@/lib/supabase-admin";
import { exigirStaff, pode } from "@/lib/staff";
import { brl, dataCurta, dataLonga, hora } from "@/lib/format";
import { Kpi, Titulo } from "@/components/admin/Titulo";

export const dynamic = "force-dynamic";

function inicioDia(d = new Date()) {
  const s = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${s}T00:00:00-03:00`);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ sem_permissao?: string }> }) {
  const staff = await exigirStaff("dashboard");
  const { sem_permissao } = await searchParams;
  const agora = new Date();
  const hoje = inicioDia();
  const semana = new Date(hoje.getTime() - 6 * 864e5);
  const mesIni = new Date(`${hoje.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7)}-01T00:00:00-03:00`);
  const trinta = new Date(hoje.getTime() - 29 * 864e5);

  const resumo = async (i: Date) => (await db().rpc("glam_resumo", { p_inicio: i.toISOString(), p_fim: agora.toISOString(), p_festa_id: null })).data as any;
  const [rHoje, rSemana, rMes, serie, festas, todasFestas] = await Promise.all([
    resumo(hoje), resumo(semana), resumo(mesIni),
    db().rpc("glam_faturamento_diario", { p_inicio: trinta.toISOString(), p_fim: agora.toISOString() }),
    db().from("glam_festas").select("id,titulo,data_inicio,lotacao,status").gte("data_inicio", new Date(Date.now() - 12 * 3600e3).toISOString()).neq("status", "cancelada").order("data_inicio").limit(6),
    db().from("glam_festas").select("id,titulo,data_inicio").neq("status", "rascunho").order("data_inicio", { ascending: false }).limit(100),
  ]);
  const verRelatorios = pode(staff, "relatorios");

  const dias: { dia: string; total: number }[] = [];
  const mapa = new Map<string, number>(((serie.data || []) as any[]).map((d) => [d.dia, Number(d.total)]));
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    dias.push({ dia: d, total: mapa.get(d) || 0 });
  }
  const max = Math.max(1, ...dias.map((d) => d.total));

  const contadores = await Promise.all(((festas.data || []) as any[]).map(async (f) => ({ f, c: (await db().rpc("glam_festa_contadores", { p_festa_id: f.id })).data as any })));

  return (
    <>
      {sem_permissao && <p className="mb-6 rounded-lg border border-perigo/40 bg-perigo/10 px-4 py-2 text-sm text-perigo">Seu nível de acesso não permite abrir aquela página.</p>}
      <Titulo sup={`Olá, ${staff.nome.split(" ")[0]}`} titulo="Visão geral">
        <Link href="/admin/festas/nova" className="btn-ouro ouro-gradiente">+ Nova festa</Link>
      </Titulo>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Hoje" valor={brl(rHoje?.faturamento)} sub={`${rHoje?.ingressos || 0} ingressos · ${rHoje?.pedidos || 0} pedidos`} />
        <Kpi rotulo="Últimos 7 dias" valor={brl(rSemana?.faturamento)} sub={`${rSemana?.ingressos || 0} ingressos`} />
        <Kpi rotulo="Este mês" valor={brl(rMes?.faturamento)} sub={`Pix ${brl(rMes?.pix)} · Cartão ${brl(rMes?.cartao)}`} />
        <Kpi rotulo="Balcão no mês" valor={brl(rMes?.balcao)} sub={`Descontos ${brl(rMes?.descontos)}`} />
      </div>

      <section className="cartao mt-6 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs uppercase tracking-[0.3em] text-fumaca">Faturamento por dia · 30 dias</h2>
          <span className="text-xs text-fumaca">pico {brl(max)}</span>
        </div>
        <div className="mt-6 flex h-40 items-end gap-1">
          {dias.map((d) => (
            <div key={d.dia} className="group relative flex-1">
              <div className="ouro-gradiente w-full rounded-t-sm opacity-80 transition group-hover:opacity-100" style={{ height: `${Math.max(2, (d.total / max) * 150)}px` }} />
              <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-linha bg-noir px-2 py-1 text-[0.65rem] group-hover:block">
                {dataCurta(d.dia + "T12:00:00-03:00")} · {brl(d.total)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {verRelatorios && (
        <section className="cartao mt-6 p-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-fumaca">Baixar relatório em PDF</h2>
          <p className="mt-1 text-sm text-fumaca">Faturamento, ingressos, portaria, pedidos e lotes — de uma festa ou de todas.</p>
          <form action="/admin/relatorios/pdf" method="get" className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div>
              <label className="rotulo">Relatório</label>
              <select name="festa" className="campo" defaultValue="">
                <option value="">Geral da casa (todas as festas)</option>
                {((todasFestas.data || []) as any[]).map((f) => <option key={f.id} value={f.id}>{f.titulo} · {dataCurta(f.data_inicio)}</option>)}
              </select>
            </div>
            <div><label className="rotulo">De (só no geral)</label><input type="date" name="de" className="campo" /></div>
            <div><label className="rotulo">Até (só no geral)</label><input type="date" name="ate" className="campo" /></div>
            <button className="btn-ouro ouro-gradiente">Baixar PDF</button>
          </form>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-xs uppercase tracking-[0.3em] text-fumaca">Próximas festas</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contadores.length === 0 && <p className="text-sm text-fumaca">Nenhuma festa futura. <Link className="text-ouro underline" href="/admin/festas/nova">Cadastre a próxima</Link>.</p>}
          {contadores.map(({ f, c }) => {
            const pct = Math.min(100, Math.round(((c?.ocupado || 0) / f.lotacao) * 100));
            return (
              <Link key={f.id} href={`/admin/festas/${f.id}`} className="cartao block p-5 transition hover:border-ouro/50">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ouro">{dataLonga(f.data_inicio)} · {hora(f.data_inicio)}</p>
                <p className="mt-1 font-display text-2xl">{f.titulo}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-linha"><div className="ouro-gradiente h-full" style={{ width: `${pct}%` }} /></div>
                <div className="mt-3 grid grid-cols-3 text-center text-xs">
                  <div><p className="font-display text-xl">{c?.ingressos || 0}</p><p className="text-fumaca">vendidos</p></div>
                  <div><p className="font-display text-xl">{c?.entraram || 0}</p><p className="text-fumaca">entraram</p></div>
                  <div><p className="font-display text-xl">{brl(c?.faturamento)}</p><p className="text-fumaca">faturado</p></div>
                </div>
                {f.status !== "publicada" && <p className="mt-3 text-[0.65rem] uppercase tracking-[0.2em] text-perigo">{f.status}</p>}
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
