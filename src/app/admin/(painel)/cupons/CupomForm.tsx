"use client";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { isoParaLocal } from "@/lib/format";
import { salvarCupom } from "../../acoes";

type Festa = { id: string; titulo: string; lotes: { id: string; nome: string }[] };

/** Formulário de cupom: cria um novo ou edita um existente. */
export function CupomForm({ festas, cupom }: { festas: Festa[]; cupom?: any }) {
  const valor = cupom ? (cupom.tipo === "valor" ? (cupom.valor / 100).toFixed(2).replace(".", ",") : String(cupom.valor)) : "";
  return (
    <FormAcao acao={salvarCupom} limparAoSalvar={!cupom} className="space-y-3">
      {cupom && <input type="hidden" name="id" value={cupom.id} />}
      <div><label className="rotulo">Código</label><input name="codigo" className="campo uppercase" placeholder="GLAM10" defaultValue={cupom?.codigo} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="rotulo">Tipo</label><select name="tipo" className="campo" defaultValue={cupom?.tipo || "percentual"}><option value="percentual">%</option><option value="valor">R$</option></select></div>
        <div><label className="rotulo">Desconto</label><input name="valor" className="campo" inputMode="decimal" placeholder="10" defaultValue={valor} required /></div>
      </div>
      <div><label className="rotulo">Festa</label><select name="festa_id" className="campo" defaultValue={cupom?.festa_id || ""}><option value="">Todas as festas</option>{festas.map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}</select></div>
      <div><label className="rotulo">Lote</label><select name="lote_id" className="campo" defaultValue={cupom?.lote_id || ""}><option value="">Qualquer lote</option>{festas.flatMap((f) => f.lotes.map((l) => <option key={l.id} value={l.id}>{f.titulo} · {l.nome}</option>))}</select></div>
      <div><label className="rotulo">Limite total de usos</label><input name="usos_max" type="number" min={1} className="campo" placeholder="Vazio = sem limite" defaultValue={cupom?.usos_max ?? ""} /></div>
      <div><label className="rotulo">Usos por cliente</label><input name="limite_por_cliente" type="number" min={1} className="campo" placeholder="Vazio = sem limite" defaultValue={cupom?.limite_por_cliente ?? ""} /></div>
      <div><label className="rotulo">Válido até</label><input name="valido_ate" type="datetime-local" className="campo" defaultValue={isoParaLocal(cupom?.valido_ate)} /></div>
      <Enviar className="btn-ouro ouro-gradiente w-full">{cupom ? "Salvar cupom" : "Criar cupom"}</Enviar>
    </FormAcao>
  );
}
