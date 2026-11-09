"use client";
import { useActionState } from "react";
import { entrar, verificarMfa } from "../auth-acoes";
import { Turnstile } from "@/components/Turnstile";

export function LoginForm({ mfaInicial }: { mfaInicial: boolean }) {
  const [estadoSenha, acaoSenha, p1] = useActionState(entrar, undefined);
  const [estadoMfa, acaoMfa, p2] = useActionState(verificarMfa, undefined);
  const etapaMfa = mfaInicial || estadoSenha?.etapa === "mfa";

  return !etapaMfa ? (
    <form action={acaoSenha} className="cartao mt-8 space-y-4 p-6">
      <div><label className="rotulo">E-mail</label><input name="email" className="campo" type="email" autoComplete="username" required maxLength={160} /></div>
      <div><label className="rotulo">Senha</label><input name="senha" className="campo" type="password" autoComplete="current-password" required maxLength={200} /></div>
      <Turnstile />
      {estadoSenha?.erro && <p className="text-sm text-perigo">{estadoSenha.erro}</p>}
      <button disabled={p1} className="btn-ouro ouro-gradiente w-full">{p1 ? "Entrando…" : "Entrar"}</button>
    </form>
  ) : (
    <form action={acaoMfa} className="cartao mt-8 space-y-4 p-6">
      <p className="text-sm text-fumaca">Verificação em 2 etapas: digite o código de 6 dígitos do seu app autenticador.</p>
      <input name="codigo" className="campo text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required />
      {estadoMfa?.erro && <p className="text-sm text-perigo">{estadoMfa.erro}</p>}
      <button disabled={p2} className="btn-ouro ouro-gradiente w-full">{p2 ? "Verificando…" : "Confirmar"}</button>
    </form>
  );
}
