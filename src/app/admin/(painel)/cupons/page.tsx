import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { brl, dataHora } from "@/lib/format";
import { Selo, Titulo } from "@/components/admin/Titulo";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { alternarCupom, salvarCupom } from "../../acoes";

export const dynamic = "force-dynamic";

export default async function Cupons() {
  await exigirStaff("cupons");
  const [{ data: cupons }, { data: festas }] = await Promise.all([
    db().from("glam_cupons").select("*, festa:glam_festas(titulo), lote:glam_lotes(nome)").order("criado_em", { ascending: false }),
    db().from("glam_festas").select("id,titulo, lotes:glam_lotes(id,nome)").neq("status", "cancelada").order("data_inicio", { ascending: false }).limit(30),
  ]);
  return (
    <>
      <Titulo sup="Vendas" titulo="Cupons de desconto" />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-[0.65rem] uppercase tracking-[0.2em] text-fumaca"><tr className="border-b border-linha"><th className="p-3">Código</th><th>Desconto</th><th>Vale para</th><th>Usos</th><th>Validade</th><th></th></tr></thead>
            <tbody>
              {(cupons || []).map((c: any) => (
                <tr key={c.id} className="border-b border-linha/60">
                  <td className="p-3 font-mono text-ouro">{c.codigo}</td>
                  <td>{c.tipo === "percentual" ? `${c.valor}%` : brl(c.valor)}</td>
                  <td className="text-fumaca">{c.festa?.titulo || "Todas"}{c.lote ? ` · ${c.lote.nome}` : ""}</td>
                  <td>{c.usos}{c.usos_max ? `/${c.usos_max}` : ""}</td>
                  <td className="text-xs text-fumaca">{c.valido_ate ? dataHora(c.valido_ate) : "—"}</td>
                  <td className="pr-3 text-right">
                    <form action={alternarCupom}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="ativo" value={c.ativo ? "0" : "1"} />
                      <button>{c.ativo ? <Selo cor="sucesso">ativo</Selo> : <Selo>inativo</Selo>}</button></form>
                  </td>
                </tr>
              ))}
              {(cupons || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-fumaca">Nenhum cupom.</td></tr>}
            </tbody>
          </table>
        </div>
        <FormAcao acao={salvarCupom} limparAoSalvar className="cartao h-fit space-y-3 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-ouro">Novo cupom</p>
          <input name="codigo" className="campo uppercase" placeholder="GLAM10" required />
          <div className="grid grid-cols-2 gap-3">
            <select name="tipo" className="campo"><option value="percentual">%</option><option value="valor">R$</option></select>
            <input name="valor" className="campo" inputMode="decimal" placeholder="10" required />
          </div>
          <select name="festa_id" className="campo" defaultValue=""><option value="">Todas as festas</option>{(festas || []).map((f: any) => <option key={f.id} value={f.id}>{f.titulo}</option>)}</select>
          <select name="lote_id" className="campo" defaultValue=""><option value="">Qualquer lote</option>{(festas || []).flatMap((f: any) => f.lotes.map((l: any) => <option key={l.id} value={l.id}>{f.titulo} · {l.nome}</option>))}</select>
          <input name="usos_max" type="number" min={1} className="campo" placeholder="Limite de usos (vazio = sem limite)" />
          <div><label className="rotulo">Válido até</label><input name="valido_ate" type="datetime-local" className="campo" /></div>
          <Enviar className="btn-ouro ouro-gradiente w-full">Criar cupom</Enviar>
        </FormAcao>
      </div>
    </>
  );
}
