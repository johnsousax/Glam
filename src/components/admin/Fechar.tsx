"use client";
import Link from "next/link";

const X = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const cls = "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-linha text-marfim hover:bg-marfim/10";

/** X que fecha a janelinha de edição (o <details> em volta). */
export function FecharJanela() {
  return (
    <button type="button" aria-label="Fechar" className={cls} onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>
      <X />
    </button>
  );
}

/** X que sai da tela e volta para a lista. */
export function SairPara({ href, rotulo = "Fechar" }: { href: string; rotulo?: string }) {
  return <Link href={href} aria-label={rotulo} className={cls}><X /></Link>;
}
