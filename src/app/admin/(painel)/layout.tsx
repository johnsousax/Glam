import { MenuPainel } from "@/components/admin/MenuPainel";
import { exigirStaff, pode } from "@/lib/staff";

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
  const staff = await exigirStaff(undefined, { permitirSemMfa: true });
  const itens = MENU.filter((m) => !m.r || pode(staff, m.r)).map((m) => ({ href: m.href, t: m.t }));
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <MenuPainel itens={itens} nome={staff.nome} papel={staff.papel} />
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
