"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { sair } from "@/app/admin/auth-acoes";
import { InstalarApp } from "./InstalarApp";

type Item = { href: string; t: string };

/** Menu do painel: lateral fixa no computador; no celular, barra com os 3 tracinhos que abre a gaveta. */
export function MenuPainel({ itens, nome, papel }: { itens: Item[]; nome: string; papel: string }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => { setAberto(false); }, [caminho]);
  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [aberto]);

  const ativo = (href: string) => (href === "/admin" ? caminho === "/admin" : caminho === href || caminho.startsWith(href + "/"));
  const atual = itens.find((i) => ativo(i.href))?.t || "Painel";

  const links = (grande: boolean) => (
    <nav className="flex flex-col gap-1">
      {itens.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          onClick={() => setAberto(false)}
          aria-current={ativo(m.href) ? "page" : undefined}
          className={`rounded-lg px-3 ${grande ? "py-3 text-base" : "py-2 text-sm"} transition ${ativo(m.href) ? "bg-ouro/15 font-semibold text-marfim" : "text-fumaca hover:bg-marfim/5 hover:text-marfim"}`}
        >
          {m.t}
        </Link>
      ))}
    </nav>
  );

  const rodape = (
    <div className="mt-6 border-t border-linha pt-4">
      <p className="text-sm font-medium text-marfim">{nome}</p>
      <p className="text-xs capitalize text-fumaca">{papel}</p>
      <InstalarApp />
      <div className="mt-3 flex items-center gap-4 text-sm">
        <Link href="/" target="_blank" className="text-fumaca underline hover:text-marfim">Ver site ↗</Link>
        <form action={sair}><button className="text-fumaca underline hover:text-perigo">Sair</button></form>
      </div>
    </div>
  );

  return (
    <>
      {/* Celular: barra superior com os 3 tracinhos */}
      <header className="nao-imprimir sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-linha bg-carvao px-3 lg:hidden">
        <button type="button" onClick={() => setAberto(true)} aria-label="Abrir menu" aria-expanded={aberto} className="flex h-11 w-11 items-center justify-center rounded-lg text-marfim hover:bg-marfim/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{atual}</span>
        <Link href="/admin" aria-label="Início do painel"><Logo className="w-16" /></Link>
      </header>

      {/* Celular: gaveta */}
      {aberto && (
        <div className="nao-imprimir fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <button type="button" aria-label="Fechar menu" onClick={() => setAberto(false)} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col overflow-y-auto border-r border-linha bg-carvao p-4">
            <div className="mb-4 flex items-center justify-between">
              <Logo className="w-20" />
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar menu" className="flex h-11 w-11 items-center justify-center rounded-lg text-marfim hover:bg-marfim/10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            {links(true)}
            {rodape}
          </div>
        </div>
      )}

      {/* Computador: menu lateral */}
      <aside className="nao-imprimir hidden border-r border-linha bg-carvao lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:p-4">
        <Link href="/admin" className="mb-1 block px-3 pt-2"><Logo className="w-24" /></Link>
        <p className="mb-4 px-3 text-xs text-fumaca">Painel da casa</p>
        {links(false)}
        <div className="px-3">{rodape}</div>
      </aside>
    </>
  );
}
