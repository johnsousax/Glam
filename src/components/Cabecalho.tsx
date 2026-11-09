import Link from "next/link";
import { Logo } from "./Logo";

export function Cabecalho() {
  return (
    <header className="sticky top-0 z-30 border-b border-linha/60 bg-noir/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Início"><Logo className="w-24" /></Link>
        <nav className="flex items-center gap-2 sm:gap-6">
          <Link href="/#festas" className="hidden text-xs uppercase tracking-[0.25em] text-fumaca hover:text-ouro sm:inline">Festas</Link>
          <Link href="/meus-ingressos" className="btn-linha !px-4 !py-2 !text-[0.65rem]">Meus ingressos</Link>
        </nav>
      </div>
    </header>
  );
}
