"use client";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { isoParaLocal } from "@/lib/format";
import type { Festa } from "@/lib/tipos";
import { salvarFesta } from "../../acoes";

export function FestaForm({ festa }: { festa?: Festa }) {
  return (
    <FormAcao acao={salvarFesta} className="cartao grid gap-4 p-6 md:grid-cols-2">
      {festa && <input type="hidden" name="id" value={festa.id} />}
      <div className="md:col-span-2"><label className="rotulo">Título</label><input name="titulo" className="campo" defaultValue={festa?.titulo} required /></div>
      <div className="md:col-span-2"><label className="rotulo">Subtítulo (line-up, tema…)</label><input name="subtitulo" className="campo" defaultValue={festa?.subtitulo || ""} /></div>
      <div><label className="rotulo">Início</label><input name="data_inicio" type="datetime-local" className="campo" defaultValue={isoParaLocal(festa?.data_inicio)} required /></div>
      <div><label className="rotulo">Término (opcional)</label><input name="data_fim" type="datetime-local" className="campo" defaultValue={isoParaLocal(festa?.data_fim)} /></div>
      <div><label className="rotulo">Local</label><input name="local_nome" className="campo" defaultValue={festa?.local_nome || "GLAM House"} /></div>
      <div><label className="rotulo">Endereço</label><input name="endereco" className="campo" defaultValue={festa?.endereco || ""} /></div>
      <div><label className="rotulo">Lotação total (pessoas)</label><input name="lotacao" type="number" min={1} className="campo" defaultValue={festa?.lotacao || 500} /></div>
      <div><label className="rotulo">Classificação</label><input name="classificacao" className="campo" defaultValue={festa?.classificacao || "18+"} /></div>
      <div>
        <label className="rotulo">Situação</label>
        <select name="status" className="campo" defaultValue={festa?.status || "rascunho"}>
          <option value="rascunho">Rascunho (não aparece no site)</option>
          <option value="publicada">Publicada (à venda)</option>
          <option value="encerrada">Encerrada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>
      <div><label className="rotulo">Cartaz (JPG/PNG/WEBP, até 8 MB)</label><input name="cartaz" type="file" accept="image/jpeg,image/png,image/webp" className="campo !py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ouro/20 file:px-3 file:py-1 file:text-ouro-claro" /></div>
      <div className="md:col-span-2"><label className="rotulo">Descrição</label><textarea name="descricao" rows={4} className="campo" defaultValue={festa?.descricao || ""} /></div>
      <label className="flex items-center gap-3 text-sm text-fumaca md:col-span-2">
        <input type="checkbox" name="mostrar_percentual" defaultChecked={festa?.mostrar_percentual} className="accent-[#d4af6a]" /> Mostrar no site o percentual vendido
      </label>
      <div className="md:col-span-2"><Enviar>{festa ? "Salvar festa" : "Criar festa"}</Enviar></div>
    </FormAcao>
  );
}
