import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { staffDaApi } from "@/lib/staff";
import { ListaCheckin, lerCorpo } from "@/lib/esquemas";
import { origemValida } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const staff = await staffDaApi("lista");
  if (!staff) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const u = new URL(req.url);
  const festa = u.searchParams.get("festa") || "";
  const q = (u.searchParams.get("q") || "").trim().slice(0, 60).replace(/[%_,()]/g, " ");
  if (q.length < 2 || !/^[0-9a-f-]{36}$/i.test(festa)) return NextResponse.json({ nomes: [] });
  const { data } = await db().from("glam_lista").select("id,nome,tipo,checkin_em").eq("festa_id", festa).ilike("nome", `%${q}%`).order("nome").limit(30);
  return NextResponse.json({ nomes: data || [] });
}

export async function POST(req: Request) {
  if (!origemValida(req)) return NextResponse.json({ erro: "Requisição inválida." }, { status: 403 });
  const staff = await staffDaApi("lista");
  if (!staff) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const b = await lerCorpo(req, ListaCheckin, 2_000);
  if (!b) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  const { id } = b;
  const { data } = await db().from("glam_lista").update({ checkin_em: new Date().toISOString(), checkin_por: staff.id }).eq("id", id).is("checkin_em", null).select("nome").maybeSingle();
  return NextResponse.json(data ? { resultado: "ok", nome: data.nome } : { resultado: "ja_utilizado" });
}
