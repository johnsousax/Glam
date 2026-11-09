import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/supabase-admin";
import { staffDaApi } from "@/lib/staff";
import { SETORES } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Base offline da portaria: só hashes dos códigos (o código real nunca fica salvo no celular). */
export async function GET(req: Request) {
  const staff = await staffDaApi("portaria");
  if (!staff) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const festa = new URL(req.url).searchParams.get("festa");
  if (!festa || !/^[0-9a-f-]{36}$/i.test(festa)) return NextResponse.json({ erro: "festa" }, { status: 400 });
  const todos: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await db().from("glam_ingressos")
      .select("codigo,nome_titular,checkin_em, lote:glam_lotes(nome,setor), pedido:glam_pedidos!inner(status)")
      .eq("festa_id", festa).eq("status", "ativo").eq("pedido.status", "pago").range(de, de + 999);
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const base: Record<string, [string, string, number]> = {};
  let entraram = 0;
  for (const t of todos) {
    const h = createHash("sha256").update(t.codigo).digest("hex").slice(0, 32);
    base[h] = [t.nome_titular, `${SETORES[t.lote.setor] || t.lote.setor} · ${t.lote.nome}`, t.checkin_em ? 1 : 0];
    if (t.checkin_em) entraram++;
  }
  return NextResponse.json({ base, vendidos: todos.length, entraram, gerado_em: new Date().toISOString() });
}
