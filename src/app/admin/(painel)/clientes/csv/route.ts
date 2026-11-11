import { db } from "@/lib/supabase-admin";
import { exigirStaff, auditar } from "@/lib/staff";

export const dynamic = "force-dynamic";

const cel = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita fórmula maliciosa no Excel
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const staff = await exigirStaff("clientes");
  const sp = new URL(req.url).searchParams;
  const { data } = await db().rpc("glam_clientes_resumo", {
    p_busca: sp.get("q") || null, p_min_compras: Math.max(0, Number(sp.get("min")) || 0),
    p_festa_id: sp.get("festa") || null, p_so_marketing: sp.get("novidades") === "1", p_limite: 20000,
  });
  const linhas = [["Nome", "E-mail", "WhatsApp", "Compras", "Ingressos", "Total (R$)", "Primeira compra", "Última compra", "Festas", "Aceita novidades"]];
  for (const c of (data || []) as any[]) {
    linhas.push([c.nome, c.email, c.whatsapp || "", c.compras, c.ingressos, (Number(c.total_centavos) / 100).toFixed(2).replace(".", ","),
      c.primeira_compra ? new Date(c.primeira_compra).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
      c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
      (c.festas || []).join(" | "), c.aceita_marketing ? "sim" : "não"]);
  }
  await auditar(staff, "clientes_exportados", "clientes", "csv", { linhas: linhas.length - 1 });
  const corpo = "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n");
  return new Response(corpo, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="clientes-glam.csv"`, "cache-control": "no-store" } });
}
