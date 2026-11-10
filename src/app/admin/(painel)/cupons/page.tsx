import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { brl, dataHora } from "@/lib/format";
import { Selo, Titulo } from "@/components/admin/Titulo";
import { Confirmar } from "@/components/admin/ui";
import { FecharJanela } from "@/components/admin/Fechar";
import { alternarCupom, excluirCupom } from "../../acoes";
import { CupomForm } from "./CupomForm";

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
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-[0.65rem] uppercase tracking-[0.2em] text-fumaca"><tr className="border-b border-linha"><th className="p-3">Código</th><th>Desconto</th><th>Vale para</th><th>Usos</th><th>Validade</th><th></th></tr></thead>
            <tbody>
              {(cupons || []).map((c: any) => (
                <tr key={c.id} className="border-b border-linha/60">
                  <td className="p-3 font-mono text-ouro">{c.codigo}</td>
                  <td>{c.tipo === "percentual" ? `${c.valor}%` : brl(c.valor)}</td>
                  <td className="text-fumaca">{c.festa?.titulo || "Todas"}{c.lote ? ` · ${c.lote.nome}` : ""}</td>
                  <td>{c.usos}{c.usos_max ? `/${c.usos_max}` : ""}</td>
                  <td className="text-xs text-fumaca">{c.valido_ate ? dataHora(c.valido_ate) : "—"}</td>
                  <td className="pr-3">
                    <div className="flex items-center justify-end gap-3">
                      <form action={alternarCupom}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="ativo" value={c.ativo ? "0" : "1"} />
                        <button title={c.ativo ? "Desativar" : "Ativar"}>{c.ativo ? <Selo cor="sucesso">ativo</Selo> : <Selo>inativo</Selo>}</button></form>
                      <details className="inline-block text-left">
                        <summary className="cursor-pointer list-none text-xs text-ouro underline">Editar</summary>
                        <div className="fixed inset-x-4 top-20 z-40 max-h-[80vh] overflow-auto rounded-2xl border border-ouro/40 bg-carvao p-5 shadow-2xl sm:left-auto sm:right-8 sm:w-[380px]">
                          <div className="mb-3 flex items-center justify-between gap-3"><p className="font-mono text-lg text-ouro">{c.codigo}</p><FecharJanela /></div>
                          <CupomForm festas={(festas || []) as any} cupom={c} />
                        </div>
                      </details>
                      <form action={excluirCupom}><input type="hidden" name="id" value={c.id} />
                        <Confirmar mensagem={`Excluir o cupom ${c.codigo}? (Se já foi usado, ele só é desativado.)`} className="text-xs text-perigo underline">Excluir</Confirmar></form>
                    </div>
                  </td>
                </tr>
              ))}
              {(cupons || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-fumaca">Nenhum cupom.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="cartao h-fit p-5">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-ouro">Novo cupom</p>
          <CupomForm festas={(festas || []) as any} />
        </div>
      </div>
    </>
  );
}
