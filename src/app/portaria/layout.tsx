import type { Metadata } from "next";

// Área da equipe: visual padrão (fonte comum) e instalável como aplicativo próprio.
export const metadata: Metadata = {
  manifest: "/painel.webmanifest",
  appleWebApp: { capable: true, title: "GLAM Painel", statusBarStyle: "black-translucent" },
  robots: { index: false },
};

export default function AreaEquipeLayout({ children }: { children: React.ReactNode }) {
  return <div className="painel relative z-10">{children}</div>;
}
