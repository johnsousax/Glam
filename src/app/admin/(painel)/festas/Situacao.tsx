"use client";
import { useTransition } from "react";
import { mudarSituacaoFesta } from "../../acoes";

const OPCOES = [
  ["publicada", "Ativo"],
  ["inativa", "Inativo"],
  ["esgotada", "Esgotado"],
  ["rascunho", "Oculto"],
  ["encerrada", "Encerrada"],
  ["cancelada", "Cancelada"],
] as const;
const COR: Record<string, string> = {
  publicada: "border-sucesso/50 text-sucesso", inativa: "border-linha text-fumaca", esgotada: "border-perigo/50 text-perigo",
  rascunho: "border-ouro/50 text-ouro", encerrada: "border-linha text-fumaca", cancelada: "border-perigo/50 text-perigo",
};

/** Seletor de situação direto na lista: Ativo, Inativo, Esgotado ou Oculto. Salva ao escolher. */
export function Situacao({ id, status }: { id: string; status: string }) {
  const [salvando, iniciar] = useTransition();
  return (
    <select
      aria-label="Situação da festa"
      defaultValue={status}
      disabled={salvando}
      onChange={(e) => {
        const f = new FormData();
        f.set("id", id); f.set("status", e.target.value);
        iniciar(() => mudarSituacaoFesta(f));
      }}
      className={`h-11 shrink-0 rounded-lg border bg-noir px-2 text-sm font-medium ${COR[status] || ""} ${salvando ? "opacity-50" : ""}`}
    >
      {OPCOES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
}
