import Link from "next/link";
import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { dataCurta, hora } from "@/lib/format";
import { Selo, Titulo } from "@/components/admin/Titulo";

export const dynamic = "force-dynamic";

export default async function Festas() {
  await exigirStaff("festas");
  const { data } = await db().from("glam_festas").select("id,titulo,slug,data_inicio,status,lotacao,cartaz_url").order("data_inicio", { ascending: false }).limit(200);
  const cor = { publicada: "sucesso", rascunho: "ouro", encerrada: "fumaca", cancelada: "perigo" } as const;
  return (
    <>
      <Titulo sup="Agenda" titulo="Festas e lotes"><Link href="/admin/festas/nova" className="btn-ouro ouro-gradiente">+ Nova festa</Link></Titulo>
      <div className="grid gap-3">
        {(data || []).length === 0 && <p className="cartao p-8 text-center text-fumaca">Cadastre a primeira festa da GLAM.</p>}
        {(data || []).map((f: any) => (
          <Link key={f.id} href={`/admin/festas/${f.id}`} className="cartao flex items-center gap-4 p-3 transition hover:border-ouro/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.cartaz_url ? <img src={f.cartaz_url} alt="" className="h-16 w-14 rounded-lg object-cover" /> : <div className="h-16 w-14 rounded-lg bg-grafite" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl">{f.titulo}</p>
              <p className="text-xs text-fumaca">{dataCurta(f.data_inicio)} às {hora(f.data_inicio)} · lotação {f.lotacao}</p>
            </div>
            <Selo cor={cor[f.status as keyof typeof cor]}>{f.status}</Selo>
          </Link>
        ))}
      </div>
    </>
  );
}
