import { exigirStaff, auditar } from "@/lib/staff";
import { relatorioFesta, relatorioGeral } from "@/lib/relatorio";
import { gerarRelatorioPdf } from "@/lib/relatorio-pdf";
import { slugify } from "@/lib/format";

export const dynamic = "force-dynamic";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PDF do relatório: ?festa=<id> (uma festa) ou ?de=AAAA-MM-DD&ate=AAAA-MM-DD (geral; sem datas = todas). */
export async function GET(req: Request) {
  const staff = await exigirStaff("relatorios");
  const sp = new URL(req.url).searchParams;
  const festa = sp.get("festa") || "";
  const de = DATA.test(sp.get("de") || "") ? sp.get("de")! : undefined;
  const ate = DATA.test(sp.get("ate") || "") ? sp.get("ate")! : undefined;
  if (festa && !UUID.test(festa)) return new Response("Festa inválida.", { status: 400 });

  const r = festa ? await relatorioFesta(festa) : await relatorioGeral(de, ate);
  if (!r) return new Response("Festa não encontrada.", { status: 404 });
  const pdf = await gerarRelatorioPdf(r);
  await auditar(staff, "relatorio_pdf_baixado", festa ? "festa" : "geral", festa || `${de || ""}..${ate || ""}`);
  const nome = festa ? `relatorio-${slugify(r.titulo) || "festa"}.pdf` : `relatorio-geral-glam${de || ate ? `-${de || "inicio"}-a-${ate || "hoje"}` : ""}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${nome}"`, "cache-control": "no-store" },
  });
}
