import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { staffDaApi } from "@/lib/staff";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const staff = await staffDaApi("lista");
  if (!staff) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const u = new URL(req.url);
  const festa = u.searchParams.get("festa") || "";
  const q = (u.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ nomes: [] });
  const { data } = await db().from("glam_lista").select("id,nome,tipo,checkin_em").eq("festa_id", festa).ilike("nome", `%${q}%`).order("nome").limit(30);
  return NextResponse.json({ nomes: data || [] });
}

export async function POST(req: Request) {
  const staff = await staffDaApi("lista");
  if (!staff) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  const { data } = await db().from("glam_lista").update({ checkin_em: new Date().toISOString(), checkin_por: staff.id }).eq("id", id).is("checkin_em", null).select("nome").maybeSingle();
  return NextResponse.json(data ? { resultado: "ok", nome: data.nome } : { resultado: "ja_utilizado" });
}
