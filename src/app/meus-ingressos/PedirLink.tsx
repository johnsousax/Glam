"use client";
import { useState } from "react";

export function PedirLink() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"livre" | "enviando" | "enviado">("livre");
  const [erro, setErro] = useState<string | null>(null);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando"); setErro(null);
    const r = await fetch("/api/meus-ingressos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    if (!r.ok) { setErro((await r.json()).erro); setEstado("livre"); return; }
    setEstado("enviado");
  }
  if (estado === "enviado")
    return (
      <div className="cartao surge mt-8 p-6">
        <p className="font-display text-2xl">Confira seu e-mail ✨</p>
        <p className="mt-2 text-sm text-fumaca">Se houver ingressos para <b className="text-marfim">{email}</b>, o link de acesso chega em instantes. Olhe também o spam.</p>
      </div>
    );
  return (
    <form onSubmit={enviar} className="cartao mt-8 space-y-4 p-6 text-left">
      <div><label className="rotulo">E-mail da compra</label><input className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <button disabled={estado === "enviando"} className="btn-ouro ouro-gradiente w-full">{estado === "enviando" ? "Enviando…" : "Receber link de acesso"}</button>
    </form>
  );
}
