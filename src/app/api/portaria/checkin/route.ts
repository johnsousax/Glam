import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { staffDaApi } from "@/lib/staff";

export const dynamic = "force-dynamic";

/** Check-in online (um código) ou sincronização da fila offline (vários). */
export async function POST(req: Request) {
  const staff = await staffDaApi("portaria");
  if (!staff) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const festa = String(b.festa_id || "");
  const codigos: string[] = (Array.isArray(b.codigos) ? b.codigos : [b.codigo]).filter(Boolean).map(String).slice(0, 500);
  const resultados = [];
  for (const c of codigos) {
    const codigo = c.replace(/^GLAM:/, "").trim();
    if (!/^[A-Za-z0-9_-]{16,40}$/.test(codigo)) { resultados.push({ codigo, resultado: "invalido" }); continue; }
    const { data } = await db().rpc("glam_checkin", { p_codigo: codigo, p_festa_id: festa, p_staff_id: staff.id });
    resultados.push({ codigo, ...(data as object) });
  }
  return NextResponse.json(codigos.length === 1 && !Array.isArray(b.codigos) ? resultados[0] : { resultados });
}
