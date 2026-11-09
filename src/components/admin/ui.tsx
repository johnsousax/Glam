"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

type Estado = { ok?: boolean; erro?: string; msg?: string } | undefined;

/** Formulário ligado a uma Server Action, com mensagem de sucesso/erro. */
export function FormAcao({
  acao, children, className = "", limparAoSalvar = false,
}: { acao: (s: Estado, f: FormData) => Promise<Estado>; children: React.ReactNode; className?: string; limparAoSalvar?: boolean }) {
  const [estado, executar] = useActionState(acao, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado?.ok && limparAoSalvar) ref.current?.reset(); }, [estado, limparAoSalvar]);
  return (
    <form ref={ref} action={executar} className={className}>
      {children}
      {estado?.erro && <p className="mt-3 rounded-lg border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm text-perigo">{estado.erro}</p>}
      {estado?.ok && estado.msg && <p className="mt-3 rounded-lg border border-sucesso/40 bg-sucesso/10 px-3 py-2 text-sm text-sucesso">{estado.msg}</p>}
    </form>
  );
}

export function Enviar({ children, className = "btn-ouro ouro-gradiente" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={className}>{pending ? "Salvando…" : children}</button>;
}

export function Confirmar({ children, mensagem, className = "" }: { children: React.ReactNode; mensagem: string; className?: string }) {
  return <button className={className} onClick={(e) => { if (!confirm(mensagem)) e.preventDefault(); }}>{children}</button>;
}
