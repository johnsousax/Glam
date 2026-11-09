import Link from "next/link";
import { Logo } from "@/components/Logo";
import { exigirStaff, pode } from "@/lib/staff";
import { sair } from "../acoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel", robots: { index: false } };

const MENU = [
  { href: "/admin", t: "Visão geral", r: "dashboard" },
  { href: "/admin/festas", t: "Festas e lotes", r: "festas" },
  { href: "/admin/pedidos", t: "Pedidos", r: "pedidos" },
  { href: "/admin/balcao", t: "Balcão e cortesias", r: "balcao" },
  { href: "/admin/cupons", t: "Cupons", r: "cupons" },
  { href: "/admin/promoters", t: "Promoters", r: "promoters" },
  { href: "/portaria", t: "Portaria", r: "portaria" },
  { href: "/admin/equipe", t: "Equipe", r: "equipe" },
  { href: "/admin/auditoria", t: "Registro de ações", r: "auditoria" },
  { href: "/admin/config", t: "Configurações", r: "config" },
  { href: "/admin/seguranca", t: "Minha segurança", r: null },
] as const;

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const staff = await exigirStaff();
  const itens = MENU.filter((m) => !m.r || pode(staff, m.r));
  return (
    <div className="relative z-10 min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="nao-imprimir border-b border-linha bg-carvao/80 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <Link href="/admin"><Logo className="w-24" /></Link>
          <p className="mt-0 text-[0.6rem] uppercase tracking-[0.35em] text-fumaca lg:mt-3">Painel da casa</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {itens.map((m) => (
            <Link key={m.href} href={m.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-fumaca transition hover:bg-ouro/10 hover:text-ouro-claro">{m.t}</Link>
          ))}
        </nav>
        <div className="hidden px-5 pt-6 lg:block">
          <div className="linha-ouro mb-4 opacity-40" />
          <p className="text-sm text-marfim">{staff.nome}</p>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ouro">{staff.papel}</p>
          <form action={sair}><button className="mt-3 text-xs text-fumaca underline hover:text-perigo">Sair</button></form>
          <Link href="/" target="_blank" className="mt-2 block text-xs text-fumaca underline hover:text-ouro">Ver site ↗</Link>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
