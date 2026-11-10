import Link from "next/link";
import { Logo } from "./Logo";

export function Rodape({ whatsapp, instagram }: { whatsapp?: string; instagram?: string }) {
  return (
    <footer className="relative z-10 mt-24 border-t border-linha/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-14 text-center">
        <Logo className="w-28 opacity-90" />
        <p className="whitespace-nowrap font-display text-[clamp(0.95rem,4.2vw,1.25rem)] italic text-marfim/80">A casinha mais amada de São Luís</p>
        <div className="flex flex-wrap justify-center gap-6 text-xs uppercase tracking-[0.25em] text-fumaca">
          {instagram && <a href={`https://instagram.com/${instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="hover:text-marfim">Instagram</a>}
          <Link href="/meus-ingressos" className="hover:text-marfim">Meus ingressos</Link>
          <Link href="/termos" className="hover:text-marfim">Termos</Link>
          <Link href="/privacidade" className="hover:text-marfim">Privacidade</Link>
        </div>
        <p className="text-[0.65rem] tracking-[0.2em] text-fumaca/60">© {new Date().getFullYear()} GLAM HOUSE · SÃO LUÍS / MA · Compra 100% segura com PagBank</p>
      </div>
    </footer>
  );
}
