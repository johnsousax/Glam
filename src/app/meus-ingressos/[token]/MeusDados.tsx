"use client";
import { useState } from "react";

export function MeusDados({ token }: { token: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function exportar() {
    const r = await fetch("/api/meus-dados", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, acao: "exportar" }) });
    if (!r.ok) return setMsg((await r.json()).erro);
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = url; a.download = "meus-dados-glam.json"; a.click(); URL.revokeObjectURL(url);
  }
  async function excluir() {
    if (!confirm("Excluir seus dados pessoais da GLAM? Isso não pode ser desfeito.")) return;
    const r = await fetch("/api/meus-dados", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, acao: "excluir" }) });
    const j = await r.json();
    setMsg(r.ok ? "Seus dados pessoais foram excluídos." : j.erro);
  }
  return (
    <section className="cartao mt-12 space-y-3 p-5">
      <h2 className="text-xs uppercase tracking-[0.35em] text-fumaca">Meus dados (LGPD)</h2>
      <div className="flex flex-wrap gap-2">
        <button onClick={exportar} className="btn-linha">Baixar meus dados</button>
        <button onClick={excluir} className="btn-linha !border-perigo/40 !text-perigo">Excluir meus dados</button>
      </div>
      {msg && <p className="text-sm text-fumaca">{msg}</p>}
    </section>
  );
}
