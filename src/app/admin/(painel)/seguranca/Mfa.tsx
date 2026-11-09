"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase-browser";

export function Mfa() {
  const sb = browserClient();
  const [fatores, setFatores] = useState<any[] | null>(null);
  const [novo, setNovo] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [senha, setSenha] = useState({ nova: "", repetir: "" });

  const carregar = async () => { const { data } = await sb.auth.mfa.listFactors(); setFatores((data?.all || []).filter((f: any) => f.status === "verified")); };
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  async function iniciar() {
    setMsg(null);
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `GLAM ${Date.now()}` });
    if (error) return setMsg(error.message);
    setNovo({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
  }
  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!novo) return;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: novo.id, code: codigo.replace(/\D/g, "") });
    if (error) return setMsg("Código inválido.");
    setNovo(null); setCodigo(""); setMsg("Verificação em 2 etapas ativada ✨"); carregar();
  }
  async function remover(id: string) {
    if (!confirm("Desativar a verificação em 2 etapas?")) return;
    const { error } = await sb.auth.mfa.unenroll({ factorId: id });
    setMsg(error ? error.message : "Desativada."); carregar();
  }
  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senha.nova.length < 10 || senha.nova !== senha.repetir) return setMsg("A senha precisa ter 10+ caracteres e as duas precisam ser iguais.");
    const { error } = await sb.auth.updateUser({ password: senha.nova });
    setMsg(error ? error.message : "Senha alterada."); setSenha({ nova: "", repetir: "" });
  }

  return (
    <div className="grid max-w-4xl gap-6 md:grid-cols-2">
      <div className="cartao space-y-4 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ouro">Verificação em 2 etapas</p>
        <p className="text-sm text-fumaca">Use Google Authenticator, Microsoft Authenticator ou 1Password. Depois de ativar, o painel pede o código a cada login.</p>
        {fatores === null ? <p className="text-sm text-fumaca">Carregando…</p> : fatores.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-sucesso">Ativada ✓</p>
            {fatores.map((f) => <button key={f.id} onClick={() => remover(f.id)} className="text-xs text-perigo underline">Desativar</button>)}
          </div>
        ) : novo ? (
          <form onSubmit={confirmar} className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={novo.qr} alt="QR do autenticador" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" />
            <p className="break-all text-center font-mono text-xs text-fumaca">{novo.segredo}</p>
            <input className="campo text-center font-mono text-xl tracking-[0.4em]" maxLength={6} inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="000000" required />
            <button className="btn-ouro ouro-gradiente w-full">Confirmar código</button>
          </form>
        ) : (
          <button onClick={iniciar} className="btn-ouro ouro-gradiente">Ativar agora</button>
        )}
      </div>
      <form onSubmit={trocarSenha} className="cartao space-y-3 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ouro">Trocar senha</p>
        <input type="password" className="campo" placeholder="Nova senha" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} autoComplete="new-password" />
        <input type="password" className="campo" placeholder="Repita a nova senha" value={senha.repetir} onChange={(e) => setSenha({ ...senha, repetir: e.target.value })} autoComplete="new-password" />
        <button className="btn-linha w-full">Salvar senha</button>
      </form>
      {msg && <p className="text-sm text-ouro-claro md:col-span-2">{msg}</p>}
    </div>
  );
}
