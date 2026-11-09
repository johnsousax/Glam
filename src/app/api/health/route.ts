import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** Usado pelo n8n para o alerta "site fora do ar". */
export async function GET() {
  const t = Date.now();
  try {
    const { error } = await db().from("glam_config").select("chave").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, banco: "ok", ms: Date.now() - t });
  } catch {
    return NextResponse.json({ ok: false, banco: "erro" }, { status: 503 });
  }
}
