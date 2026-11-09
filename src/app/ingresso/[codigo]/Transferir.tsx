"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Transferir({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ nome: "", email: "", whatsapp: "", email_atual: "" });
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setMsg(null);
    const r = await fetch(`/api/ingressos/${codigo}/transferir`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({ erro: "Muitas tentativas. Aguarde." }));
    setEnviando(false);
    if (!r.ok) return setMsg({ ok: false, texto: j.erro });
    setMsg({ ok: true, texto: "Ingresso transferido! O novo QR foi enviado para a pessoa." });
    setTimeout(() => router.push(`/meus-ingressos`), 2500);
  }

  if (!aberto) return <button onClick={() => setAberto(true)} className="btn-linha mt-6 w-full">Transferir para outra pessoa</button>;
  return (
    <form onSubmit={enviar} className="cartao surge mt-6 space-y-4 p-6">
      <h2 className="font-display text-2xl">Transferir ingresso</h2>
      <p className="text-xs leading-relaxed text-fumaca">Um novo QR é gerado para a pessoa e este deixa de valer. Para confirmar, informe o e-mail usado na compra.</p>
      <div><label className="rotulo">Seu e-mail (da compra)</label><input className="campo" type="email" value={f.email_atual} onChange={(e) => setF({ ...f, email_atual: e.target.value })} required /></div>
      <div><label className="rotulo">Nome de quem vai usar</label><input className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></div>
      <div><label className="rotulo">E-mail dessa pessoa</label><input className="campo" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
      <div><label className="rotulo">WhatsApp dessa pessoa</label><input className="campo" inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
      {msg && <p className={`text-sm ${msg.ok ? "text-sucesso" : "text-perigo"}`}>{msg.texto}</p>}
      <button disabled={enviando} className="btn-ouro ouro-gradiente w-full">{enviando ? "Transferindo…" : "Confirmar transferência"}</button>
    </form>
  );
}
