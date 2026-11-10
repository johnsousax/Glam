import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { Leitor } from "./Leitor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portaria", robots: { index: false } };

export default async function Portaria({ searchParams }: { searchParams: Promise<{ festa?: string }> }) {
  const staff = await exigirStaff("portaria");
  const { festa } = await searchParams;
  const { data: festas } = await db().from("glam_festas").select("id,titulo,data_inicio")
    .in("status", ["publicada", "inativa", "esgotada", "encerrada"])
    .gte("data_inicio", new Date(Date.now() - 36 * 3600e3).toISOString())
    .lte("data_inicio", new Date(Date.now() + 14 * 864e5).toISOString())
    .order("data_inicio");
  return <Leitor festas={festas || []} festaInicial={festa || festas?.[0]?.id || ""} nomeStaff={staff.nome} admin={staff.papel !== "portaria"} />;
}
