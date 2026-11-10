import { db } from "@/lib/supabase-admin";
import { exigirStaff, pode } from "@/lib/staff";
import { brl, SETORES } from "@/lib/format";
import { Titulo } from "@/components/admin/Titulo";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { vendaBalcao } from "../../acoes";

export const dynamic = "force-dynamic";

export default async function Balcao() {
  const staff = await exigirStaff("balcao");
  const { data: festas } = await db().from("glam_festas").select("id,titulo, lotes:glam_lotes(id,nome,setor,preco_centavos,ativo)").in("status", ["publicada", "inativa", "esgotada", "rascunho"]).gte("data_inicio", new Date(Date.now() - 12 * 3600e3).toISOString()).order("data_inicio");
  const opcoes = (festas || []).flatMap((f: any) => f.lotes.filter((l: any) => l.ativo).map((l: any) => ({ festa: f.id, lote: l.id, rotulo: `${f.titulo} — ${SETORES[l.setor] || l.setor} · ${l.nome} (${brl(l.preco_centavos)})` })));
  return (
    <>
      <Titulo sup="Vendas" titulo="Balcão e cortesias" />
      <FormAcao acao={vendaBalcao} limparAoSalvar className="cartao grid max-w-3xl gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="rotulo">Festa e lote</label>
          <select name="festa_lote" className="campo" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            {opcoes.map((o) => <option key={o.lote} value={`${o.festa}|${o.lote}`}>{o.rotulo}</option>)}
          </select>
        </div>
        <div><label className="rotulo">Quantidade</label><input name="quantidade" type="number" min={1} max={50} defaultValue={1} className="campo" /></div>
        <div>
          <label className="rotulo">Forma</label>
          <select name="metodo" className="campo" defaultValue="dinheiro">
            <option value="dinheiro">Dinheiro</option>
            <option value="maquininha">Maquininha</option>
            {pode(staff, "cortesia") && <option value="cortesia">Cortesia (R$ 0)</option>}
          </select>
        </div>
        <div><label className="rotulo">Nome do cliente</label><input name="nome" className="campo" required /></div>
        <div><label className="rotulo">WhatsApp (opcional)</label><input name="whatsapp" className="campo" inputMode="tel" /></div>
        <div className="sm:col-span-2"><label className="rotulo">E-mail (opcional — recebe o QR)</label><input name="email" type="email" className="campo" /></div>
        <div className="sm:col-span-2"><label className="rotulo">Nomes dos ingressos (um por linha, opcional)</label><textarea name="nomes" rows={3} className="campo" /></div>
        <div className="sm:col-span-2"><label className="rotulo">Código do promoter (opcional)</label><input name="promoter" className="campo" /></div>
        <div className="sm:col-span-2"><Enviar>Emitir ingressos</Enviar></div>
      </FormAcao>
      <p className="mt-4 max-w-3xl text-xs text-fumaca">Vendas no balcão e cortesias ficam registradas no “Registro de ações” com o nome de quem emitiu. Sem e-mail, o QR pode ser mostrado pela página do pedido em “Pedidos”.</p>
    </>
  );
}

