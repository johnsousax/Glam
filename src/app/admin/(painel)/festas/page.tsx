import Link from "next/link";
import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { dataCurta, hora } from "@/lib/format";
import { Titulo } from "@/components/admin/Titulo";
import { Situacao } from "./Situacao";

export const dynamic = "force-dynamic";

export default async function Festas() {
  await exigirStaff("festas");
  const { data } = await db().from("glam_festas").select("id,titulo,slug,data_inicio,status,lotacao,cartaz_url").order("data_inicio", { ascending: false }).limit(200);
  return (
    <>
      <Titulo sup="Agenda" titulo="Festas e lotes"><Link href="/admin/festas/nova" className="btn-ouro ouro-gradiente">+ Nova festa</Link></Titulo>
      <div className="grid gap-3">
        {(data || []).length === 0 && <p className="cartao p-8 text-center text-fumaca">Cadastre a primeira festa da GLAM.</p>}
        {(data || []).map((f: any) => (
          <div key={f.id} className="cartao flex items-center gap-3 p-3">
            <Link href={`/admin/festas/${f.id}`} className="flex min-w-0 flex-1 items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.cartaz_url ? <img src={f.cartaz_url} alt="" className="h-16 w-14 rounded-lg object-cover" /> : <div className="h-16 w-14 rounded-lg bg-grafite" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl">{f.titulo}</p>
                <p className="text-xs text-fumaca">{dataCurta(f.data_inicio)} às {hora(f.data_inicio)} · lotação {f.lotacao}</p>
              </div>
            </Link>
            <Situacao id={f.id} status={f.status} />
          </div>
        ))}
      </div>
    </>
  );
}
