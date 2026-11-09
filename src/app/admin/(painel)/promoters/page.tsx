import { db } from "@/lib/supabase-admin";
import { exigirStaff, pode } from "@/lib/staff";
import { env } from "@/lib/env";
import { brl } from "@/lib/format";
import { configCasa } from "@/lib/config";
import { Selo, Titulo } from "@/components/admin/Titulo";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { salvarPromoter } from "../../acoes";

export const dynamic = "force-dynamic";

export default async function Promoters() {
  const staff = await exigirStaff("promoters");
  const [{ data: promoters }, { data: vendas }, casa] = await Promise.all([
    db().from("glam_promoters").select("*").order("nome"),
    db().from("glam_pedidos").select("promoter_id,total_centavos").eq("status", "pago").not("promoter_id", "is", null),
    configCasa(),
  ]);
  const tot = new Map<string, { total: number; n: number }>();
  (vendas || []).forEach((v: any) => { const t = tot.get(v.promoter_id) || { total: 0, n: 0 }; t.total += v.total_centavos; t.n++; tot.set(v.promoter_id, t); });
  const edita = pode(staff, "festas");
  return (
    <>
      <Titulo sup="Vendas" titulo="Promoters" />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {(promoters || []).length === 0 && <p className="cartao p-6 text-fumaca">Nenhum promoter cadastrado.</p>}
          {(promoters || []).map((p: any) => {
            const t = tot.get(p.id) || { total: 0, n: 0 };
            const link = `${env.siteUrl}/?ref=${p.codigo}`;
            return (
              <div key={p.id} className="cartao p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-display text-2xl">{p.nome}</p><p className="text-xs text-fumaca">{p.whatsapp || ""} {p.email || ""}</p></div>
                  {p.ativo ? <Selo cor="sucesso">ativo</Selo> : <Selo>inativo</Selo>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="rounded-xl border border-linha p-3"><p className="font-display text-xl">{t.n}</p><p className="text-fumaca">pedidos</p></div>
                  <div className="rounded-xl border border-linha p-3"><p className="font-display text-xl">{brl(t.total)}</p><p className="text-fumaca">vendido</p></div>
                  <div className="rounded-xl border border-ouro/40 p-3"><p className="font-display text-xl text-ouro">{brl(Math.round(t.total * Number(p.comissao_percentual) / 100))}</p><p className="text-fumaca">comissão ({Number(p.comissao_percentual)}%)</p></div>
                </div>
                <p className="mt-3 break-all rounded-lg bg-noir/60 p-2 font-mono text-xs text-ouro-claro">{link}</p>
              </div>
            );
          })}
        </div>
        {edita && (
          <FormAcao acao={salvarPromoter} limparAoSalvar className="cartao h-fit space-y-3 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-ouro">Novo promoter</p>
            <input name="nome" className="campo" placeholder="Nome" required />
            <input name="codigo" className="campo" placeholder="código do link (ex.: joao)" />
            <input name="whatsapp" className="campo" placeholder="WhatsApp" />
            <input name="email" type="email" className="campo" placeholder="E-mail" />
            <div><label className="rotulo">Comissão (%)</label><input name="comissao" className="campo" inputMode="decimal" defaultValue={casa.comissao_padrao} /></div>
            <Enviar className="btn-ouro ouro-gradiente w-full">Cadastrar</Enviar>
          </FormAcao>
        )}
      </div>
    </>
  );
}
