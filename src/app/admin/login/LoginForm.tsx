"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase-browser";

export function LoginForm({ mfaInicial }: { mfaInicial: boolean }) {
  const [etapa, setEtapa] = useState<"senha" | "mfa">(mfaInicial ? "mfa" : "senha");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const sb = browserClient();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setCarregando(true);
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) { setCarregando(false); return setErro("E-mail ou senha incorretos."); }
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    setCarregando(false);
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return setEtapa("mfa");
    location.href = "/admin";
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setCarregando(true);
    const { data: fatores } = await sb.auth.mfa.listFactors();
    const totp = fatores?.totp?.[0];
    if (!totp) { setCarregando(false); return setErro("Nenhum autenticador cadastrado."); }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: totp.id, code: codigo.replace(/\D/g, "") });
    setCarregando(false);
    if (error) return setErro("Código inválido. Confira o app autenticador.");
    location.href = "/admin";
  }

  return etapa === "senha" ? (
    <form onSubmit={entrar} className="cartao mt-8 space-y-4 p-6">
      <div><label className="rotulo">E-mail</label><input className="campo" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label className="rotulo">Senha</label><input className="campo" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <button disabled={carregando} className="btn-ouro ouro-gradiente w-full">{carregando ? "Entrando…" : "Entrar"}</button>
    </form>
  ) : (
    <form onSubmit={verificar} className="cartao mt-8 space-y-4 p-6">
      <p className="text-sm text-fumaca">Verificação em 2 etapas: digite o código de 6 dígitos do seu app autenticador.</p>
      <input className="campo text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus required />
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <button disabled={carregando} className="btn-ouro ouro-gradiente w-full">{carregando ? "Verificando…" : "Confirmar"}</button>
    </form>
  );
}
