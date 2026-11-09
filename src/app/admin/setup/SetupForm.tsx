"use client";
import { useActionState } from "react";
import Link from "next/link";
import { criarDono } from "./acao";

export function SetupForm() {
  const [estado, acao, pendente] = useActionState(criarDono, undefined);
  if (estado?.ok) return (
    <div className="cartao mt-8 p-6 text-center">
      <p className="font-display text-2xl">Conta criada ✨</p>
      <Link href="/admin/login" className="btn-ouro ouro-gradiente mt-5">Entrar no painel</Link>
    </div>
  );
  return (
    <form action={acao} className="cartao mt-8 space-y-4 p-6">
      <div><label className="rotulo">Seu nome</label><input name="nome" className="campo" required /></div>
      <div><label className="rotulo">E-mail</label><input name="email" type="email" className="campo" required /></div>
      <div><label className="rotulo">Senha (mín. 10 caracteres)</label><input name="senha" type="password" minLength={10} className="campo" required /></div>
      {estado?.erro && <p className="text-sm text-perigo">{estado.erro}</p>}
      <button disabled={pendente} className="btn-ouro ouro-gradiente w-full">{pendente ? "Criando…" : "Criar conta do dono"}</button>
    </form>
  );
}
