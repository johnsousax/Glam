import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { staffDaApi } from "@/lib/staff";
import { Checkin, lerCorpo } from "@/lib/esquemas";
import { dentroDoLimite, origemValida, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/** Check-in online (um código) ou sincronização da fila offline (vários). */
export async function POST(req: Request) {
  if (!origemValida(req)) return NextResponse.json({ erro: "Requisição inválida." }, { status: 403 });
  const staff = await staffDaApi("portaria");
  if (!staff) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  if (!(await dentroDoLimite(`portaria:${staff.id}`, 1200, 600))) return respostaLimite();
  const b = await lerCorpo(req, Checkin, 64_000);
  if (!b) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  const festa = b.festa_id;
  const codigos: string[] = "codigos" in b ? b.codigos : [b.codigo];
  const resultados = [];
  for (const c of codigos) {
    const codigo = c.replace(/^GLAM:/, "").trim();
    if (!/^[A-Za-z0-9_-]{16,40}$/.test(codigo)) { resultados.push({ codigo, resultado: "invalido" }); continue; }
    const { data } = await db().rpc("glam_checkin", { p_codigo: codigo, p_festa_id: festa, p_staff_id: staff.id });
    resultados.push({ codigo, ...(data as object) });
  }
  return NextResponse.json("codigos" in b ? { resultados } : resultados[0]);
}
