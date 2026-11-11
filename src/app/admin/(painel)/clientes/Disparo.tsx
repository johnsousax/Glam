"use client";
import { useState, useTransition } from "react";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { contarPublico, enviarDisparo } from "../../clientes-acoes";

/** Disparo de novidades por e-mail para os clientes. */
export function Disparo({ festas }: { festas: { id: string; titulo: string }[] }) {
  const [total, setTotal] = useState<number | null>(null);
  const [contando, iniciar] = useTransition();
  const contar = (form: HTMLFormElement | null) => {
    if (!form) return;
    const f = new FormData(form);
    iniciar(async () => setTotal(await contarPublico(f)));
  };
  return (
    <section className="max-w-3xl">
      <h2 className="mb-1 text-lg font-semibold">Disparo por e-mail</h2>
      <p className="mb-3 text-sm text-fumaca">Vai para todos os clientes do público escolhido, menos quem clicou em “não quero mais receber”. Use {"{nome}"} para chamar a pessoa pelo nome.</p>
      <FormAcao acao={enviarDisparo} className="cartao space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2" onChange={(e) => contar((e.currentTarget as HTMLElement).closest("form"))}>
          <div><label className="rotulo">Público</label>
            <select name="min_compras" className="campo" defaultValue="0">
              <option value="0">Todos os clientes</option><option value="1">Já compraram 1+ vez</option><option value="2">Compraram 2+ vezes</option><option value="3">Compraram 3+ vezes</option>
            </select>
          </div>
          <div><label className="rotulo">Festa</label>
            <select name="festa_id" className="campo" defaultValue=""><option value="">Qualquer festa</option>{festas.map((f) => <option key={f.id} value={f.id}>Foi na {f.titulo}</option>)}</select>
          </div>
        </div>
        <div><label className="rotulo">Assunto</label><input name="assunto" className="campo" maxLength={120} required placeholder="Sábado tem Submundo Glam 🔥" /></div>
        <div><label className="rotulo">Mensagem</label><textarea name="mensagem" rows={6} className="campo" maxLength={5000} required placeholder={"Oi, {nome}!\n\nO 1º lote do Submundo Glam já está à venda…"} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="rotulo">Link do botão (opcional)</label><input name="botao_url" className="campo" placeholder="https://www.glamhouse.site/festa/…" /></div>
          <div><label className="rotulo">Texto do botão</label><input name="botao_texto" className="campo" placeholder="Comprar ingresso" maxLength={40} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-linha" onClick={(e) => contar(e.currentTarget.closest("form"))}>{contando ? "Contando…" : "Ver quantos vão receber"}</button>
          {total != null && <span className="text-sm text-fumaca">{total} cliente(s) vão receber</span>}
        </div>
        <Enviar>Enviar disparo</Enviar>
      </FormAcao>
    </section>
  );
}
