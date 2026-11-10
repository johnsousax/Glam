import { NextResponse } from "next/server";
import { pagamentos } from "@/lib/gateways";
import { db } from "@/lib/supabase-admin";
import { confirmarPagamento } from "@/lib/pedidos";
import { origemValida } from "@/lib/seguranca";
import { compradorDoPedido } from "@/lib/acesso-pedido";

export const dynamic = "force-dynamic";

/** Só existe em modo demonstração (nenhum gateway conectado): simula o Pix pago. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await pagamentos()).demo) return NextResponse.json({ erro: "Indisponível." }, { status: 404 });
  if (!origemValida(req)) return NextResponse.json({ erro: "Requisição inválida." }, { status: 403 });
  const { id } = await params;
  const { data: p } = await db().from("glam_pedidos").select("id,status,expira_em,acesso_hash,gateway").eq("id", id).maybeSingle();
  if (!p || p.status !== "pendente" || (p.gateway && p.gateway !== "demo")) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  if (!(await compradorDoPedido(p.id, p.acesso_hash))) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  await confirmarPagamento(id, "DEMO", "pix");
  return NextResponse.json({ status: "pago" });
}
