import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { Selo, Titulo } from "@/components/admin/Titulo";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { alterarMembro, salvarMembro } from "../../acoes";

export const dynamic = "force-dynamic";

const PAPEIS = { dono: "Dono — tudo", gerente: "Gerente — festas, vendas, portaria", financeiro: "Financeiro — faturamento e relatórios", portaria: "Portaria — só leitura de QR e lista" };

export default async function Equipe() {
  const eu = await exigirStaff("equipe");
  const { data } = await db().from("glam_staff").select("*").order("criado_em");
  return (
    <>
      <Titulo sup="Acessos" titulo="Equipe" />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {(data || []).map((m: any) => (
            <div key={m.id} className="cartao flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1"><p className="font-display text-xl">{m.nome}{m.id === eu.id && <span className="text-sm text-fumaca"> (você)</span>}</p><p className="text-xs text-fumaca">{m.email}</p></div>
              <form action={alterarMembro} className="flex items-center gap-2">
                <input type="hidden" name="id" value={m.id} />
                <select name="papel" defaultValue={m.papel} className="campo !w-auto !py-2 text-sm" disabled={m.id === eu.id}>
                  {Object.keys(PAPEIS).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                {m.id !== eu.id && <button className="btn-linha !px-3 !py-2">Salvar</button>}
              </form>
              {m.id !== eu.id && (
                <form action={alterarMembro}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="ativo" value={m.ativo ? "0" : "1"} />
                  <button>{m.ativo ? <Selo cor="sucesso">ativo</Selo> : <Selo cor="perigo">bloqueado</Selo>}</button></form>
              )}
            </div>
          ))}
        </div>
        <FormAcao acao={salvarMembro} limparAoSalvar className="cartao h-fit space-y-3 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-ouro">Adicionar pessoa</p>
          <input name="nome" className="campo" placeholder="Nome" required />
          <input name="email" type="email" className="campo" placeholder="E-mail" required />
          <select name="papel" className="campo" defaultValue="portaria">{Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="senha" type="text" className="campo" placeholder="Senha provisória (mín. 10)" minLength={10} required />
          <Enviar className="btn-ouro ouro-gradiente w-full">Adicionar</Enviar>
          <p className="text-xs text-fumaca">Peça para cada pessoa ativar a verificação em 2 etapas em “Minha segurança”.</p>
        </FormAcao>
      </div>
    </>
  );
}
