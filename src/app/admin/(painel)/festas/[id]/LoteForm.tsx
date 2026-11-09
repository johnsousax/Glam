"use client";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { isoParaLocal, SETORES } from "@/lib/format";
import type { Lote } from "@/lib/tipos";
import { salvarLote } from "../../../acoes";

export function LoteForm({ festaId, lote, proximaOrdem = 1 }: { festaId: string; lote?: Lote; proximaOrdem?: number }) {
  return (
    <FormAcao acao={salvarLote} limparAoSalvar={!lote} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="festa_id" value={festaId} />
      {lote && <input type="hidden" name="id" value={lote.id} />}
      <div><label className="rotulo">Setor</label>
        <select name="setor" className="campo" defaultValue={lote?.setor || "pista"}>
          {Object.entries(SETORES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div><label className="rotulo">Nome do lote</label><input name="nome" className="campo" placeholder="1º lote" defaultValue={lote?.nome} required /></div>
      <div><label className="rotulo">Preço (R$)</label><input name="preco" className="campo" inputMode="decimal" defaultValue={lote ? (lote.preco_centavos / 100).toFixed(2) : ""} required /></div>
      <div><label className="rotulo">Quantidade à venda</label><input name="capacidade" type="number" min={0} className="campo" defaultValue={lote?.capacidade} required /></div>
      <div><label className="rotulo">Pessoas por unidade</label><input name="pessoas_por_unidade" type="number" min={1} className="campo" defaultValue={lote?.pessoas_por_unidade || 1} title="Camarote/mesa para N pessoas" /></div>
      <div><label className="rotulo">Máx. por pedido</label><input name="max_por_pedido" type="number" min={1} className="campo" defaultValue={lote?.max_por_pedido || 10} /></div>
      <div><label className="rotulo">Ordem da virada</label><input name="ordem" type="number" className="campo" defaultValue={lote?.ordem ?? proximaOrdem} /></div>
      <div><label className="rotulo">Descrição curta</label><input name="descricao" className="campo" defaultValue={lote?.descricao || ""} /></div>
      <div><label className="rotulo">Início das vendas</label><input name="inicio_vendas" type="datetime-local" className="campo" defaultValue={isoParaLocal(lote?.inicio_vendas)} /></div>
      <div><label className="rotulo">Fim das vendas (vira o lote)</label><input name="fim_vendas" type="datetime-local" className="campo" defaultValue={isoParaLocal(lote?.fim_vendas)} /></div>
      {lote && (
        <div><label className="rotulo">Ativo</label>
          <select name="ativo" className="campo" defaultValue={lote.ativo ? "true" : "false"}><option value="true">Sim</option><option value="false">Não</option></select>
        </div>
      )}
      <div className="flex items-end"><Enviar className="btn-ouro ouro-gradiente w-full">{lote ? "Salvar" : "+ Adicionar lote"}</Enviar></div>
    </FormAcao>
  );
}
