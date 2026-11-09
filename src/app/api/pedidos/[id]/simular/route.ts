import { NextResponse } from "next/server";
import { modoDemo } from "@/lib/env";
import { db } from "@/lib/supabase-admin";
import { confirmarPagamento } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

/** Só existe em modo demonstração (sem PAGBANK_TOKEN): simula o Pix pago. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!modoDemo()) return NextResponse.json({ erro: "Indisponível." }, { status: 404 });
  const { id } = await params;
  const { data: p } = await db().from("glam_pedidos").select("id,status,expira_em").eq("id", id).maybeSingle();
  if (!p || p.status !== "pendente") return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  await confirmarPagamento(id, "DEMO", "pix");
  return NextResponse.json({ status: "pago" });
}
