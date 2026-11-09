"use client";
import { useActionState, useState } from "react";
import { confirmarMfa, iniciarMfa, trocarSenha, type NovoMfa } from "../../auth-acoes";

export function Mfa({ temMfa, obrigatorio }: { temMfa: boolean; obrigatorio: boolean }) {
  const [novo, setNovo] = useState<NovoMfa | null>(null);
  const [eMfa, aMfa, pMfa] = useActionState(confirmarMfa, undefined);
  const [eSenha, aSenha, pSenha] = useActionState(trocarSenha, undefined);
  const ativo = temMfa || eMfa?.ok;

  return (
    <div className="grid max-w-4xl gap-6 md:grid-cols-2">
      <div className="cartao space-y-4 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ouro">Verificação em 2 etapas</p>
        {obrigatorio && !ativo && (
          <p className="rounded-lg border border-ouro/40 bg-ouro/10 px-3 py-2 text-sm text-ouro-claro">Para o seu nível de acesso, a verificação em 2 etapas é obrigatória. Ative para liberar o painel.</p>
        )}
        <p className="text-sm text-fumaca">Use Google Authenticator, Microsoft Authenticator ou 1Password. O painel pede o código a cada login.</p>
        {ativo ? (
          <div className="space-y-2">
            <p className="text-sm text-sucesso">Ativada ✓</p>
            {eMfa?.ok && <a href="/admin" className="btn-ouro ouro-gradiente">Ir para o painel</a>}
          </div>
        ) : novo && "id" in novo ? (
          <form action={aMfa} className="space-y-3">
            <input type="hidden" name="factorId" value={novo.id} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={novo.qr} alt="QR do autenticador" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" />
            <p className="break-all text-center font-mono text-xs text-fumaca">{novo.segredo}</p>
            <input name="codigo" className="campo text-center font-mono text-xl tracking-[0.4em]" maxLength={6} inputMode="numeric" placeholder="000000" required />
            {eMfa?.erro && <p className="text-sm text-perigo">{eMfa.erro}</p>}
            <button disabled={pMfa} className="btn-ouro ouro-gradiente w-full">Confirmar código</button>
          </form>
        ) : (
          <>
            <button onClick={async () => setNovo(await iniciarMfa())} className="btn-ouro ouro-gradiente">Ativar agora</button>
            {novo && "erro" in novo && <p className="text-sm text-perigo">{novo.erro}</p>}
          </>
        )}
      </div>
      <form action={aSenha} className="cartao space-y-3 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ouro">Trocar senha</p>
        <input name="atual" type="password" className="campo" placeholder="Senha atual" autoComplete="current-password" required />
        <input name="nova" type="password" className="campo" placeholder="Nova senha (mín. 12)" minLength={12} autoComplete="new-password" required />
        <input name="repetir" type="password" className="campo" placeholder="Repita a nova senha" minLength={12} autoComplete="new-password" required />
        {eSenha?.erro && <p className="text-sm text-perigo">{eSenha.erro}</p>}
        {eSenha?.ok && <p className="text-sm text-sucesso">{eSenha.msg}</p>}
        <button disabled={pSenha} className="btn-linha w-full">Salvar senha</button>
      </form>
    </div>
  );
}
