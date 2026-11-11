import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { brl, TZ } from "./format";
import type { Relatorio } from "./relatorio";

// Fontes padrão do PDF: alfabeto latino com acentos; tira emoji e afins.
const limpo = (s: unknown) => String(s ?? "").normalize("NFC").replace(/[–—]/g, "-").replace(/[^ -~ -ÿ]/g, "").trim();
const num = (n: number) => n.toLocaleString("pt-BR");

const PRETO = rgb(0.04, 0.04, 0.04), CINZA = rgb(0.45, 0.45, 0.45), CINZA_CLARO = rgb(0.6, 0.6, 0.6);
const LINHA = rgb(0.86, 0.86, 0.86), OURO = rgb(0.96, 0.69, 0.12), VERDE = rgb(0.12, 0.55, 0.3), BRANCO = rgb(1, 1, 1);

/** PDF branco e limpo, no padrão do relatório que a casa já usava. */
export async function gerarRelatorioPdf(r: Relatorio, autor = "jonsousax"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(limpo(`Relatório - ${r.titulo}`));
  doc.setAuthor("GLAM");
  doc.setCreator("GLAM");
  const W = 595.28, H = 841.89, M = 42;
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const rotuloTopo = r.tipo === "festa" ? "RELATÓRIO DO EVENTO" : "RELATÓRIO GERAL";

  let pg: PDFPage;
  let y = 0;
  const texto = (t: string, x: number, yy: number, tam: number, f: PDFFont = normal, cor = PRETO) => pg.drawText(limpo(t), { x, y: yy, size: tam, font: f, color: cor });
  const direita = (t: string, xDir: number, yy: number, tam: number, f: PDFFont = normal, cor = PRETO) => texto(t, xDir - f.widthOfTextAtSize(limpo(t), tam), yy, tam, f, cor);
  const cortar = (t: string, larg: number, tam: number, f: PDFFont) => { let s = limpo(t); while (s.length > 3 && f.widthOfTextAtSize(s, tam) > larg) s = s.slice(0, -2); return s === limpo(t) ? s : s.trimEnd() + "..."; };

  const rodape = () => texto(`Site desenvolvido por ${autor}`, M, 28, 7.5, normal, CINZA_CLARO);
  const novaPagina = () => {
    pg = doc.addPage([W, H]);
    pg.drawRectangle({ x: 0, y: H - 56, width: W, height: 56, color: PRETO });
    texto("GLAM", M, H - 36, 20, negrito, BRANCO);
    direita(rotuloTopo, W - M, H - 32, 8.5, normal, CINZA_CLARO);
    rodape();
    y = H - 56 - 34;
  };
  const espaco = (precisa: number) => { if (y - precisa < 60) novaPagina(); };

  // ---------- Cabeçalho ----------
  novaPagina();
  texto(cortar(r.titulo, W - 2 * M, 19, negrito), M, y, 19, negrito);
  y -= 20;
  if (r.tipo === "festa" && r.data_inicio) {
    const d = new Date(r.data_inicio);
    const dia = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
    const hr = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
    texto(`${dia}  ${hr}h   GLAM`, M, y, 9.5, normal, CINZA);
  } else {
    const br = (s?: string) => (s ? s.split("-").reverse().join("/") : "");
    const p = r.periodo || {};
    texto(p.de || p.ate ? `Festas de ${br(p.de) || "início"} até ${br(p.ate) || "hoje"}` : `${r.festas.length} festa(s) no total`, M, y, 9.5, normal, CINZA);
  }
  y -= 14;
  texto(`Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: TZ })}`, M, y, 7.5, normal, CINZA_CLARO);
  y -= 16;

  // ---------- Seções ----------
  const secao = (titulo: string) => {
    espaco(48);
    pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: OURO });
    y -= 16;
    texto(titulo, M, y, 10, negrito);
    y -= 22;
  };
  const linha = (rot: string, valor: string, destaque = false) => {
    espaco(18);
    texto(rot, M, y, 9, normal, CINZA);
    direita(valor, W - M, y, destaque ? 11 : 9, destaque ? negrito : normal, destaque ? VERDE : PRETO);
    y -= 17.5;
  };
  const nota = (t: string) => { espaco(16); texto(t, M, y + 2, 7.5, normal, CINZA); y -= 14; };
  const n = r.n;

  secao("FATURAMENTO");
  linha("Faturamento bruto", brl(n.bruto), true);
  linha("Vendas pelo site (Pix)", brl(n.sitePix));
  if (n.siteCartao) linha("Vendas pelo site (cartão)", brl(n.siteCartao));
  linha("Vendas no balcão", brl(n.balcao));
  linha("Devoluções / estornos", brl(n.estornos));
  linha("Faturamento líquido", brl(n.liquido), true);
  linha("Ticket médio", brl(n.ticketMedio));
  y -= 6;

  secao("INGRESSOS");
  linha(r.tipo === "festa" ? "Capacidade do evento" : "Capacidade somada das festas", num(n.capacidade));
  linha("Ingressos pagos", num(n.pagos));
  linha("Cortesias (não entram no faturamento)", num(n.cortesias));
  linha("Total emitido", num(n.emitidos));
  linha("Ainda disponíveis", num(n.disponiveis));
  linha("Ingressos cancelados", num(n.cancelados));
  y -= 6;

  secao("PÚBLICO NA PORTARIA");
  linha(r.tipo === "festa" ? "Entradas realizadas até agora" : "Entradas realizadas", num(n.entraram));
  linha("Ainda não entraram", num(n.naoEntraram));
  if (n.lista) linha("Lista de nomes (entraram / total)", `${num(n.listaEntraram)} / ${num(n.lista)}`);
  if (r.tipo === "festa" && r.data_inicio && Date.now() < new Date(r.data_inicio).getTime() + 12 * 3600e3) nota("O número de no-show só fecha depois da festa.");
  y -= 6;

  secao("PEDIDOS");
  linha("Pedidos pagos", num(n.pedidosPagos));
  linha("Pedidos expirados ou cancelados", num(n.pedidosPerdidos));
  linha("Reembolsos", num(n.reembolsos));
  y -= 6;

  // ---------- Tabelas ----------
  const tabela = (titulo: string, cols: { t: string; x: number; dir?: boolean }[], linhas: string[][]) => {
    secao(titulo);
    const cab = () => { cols.forEach((c) => (c.dir ? direita(c.t, c.x, y, 7, normal, CINZA_CLARO) : texto(c.t, c.x, y, 7, normal, CINZA_CLARO))); y -= 16; };
    cab();
    for (const l of linhas) {
      if (y < 78) { novaPagina(); cab(); }
      l.forEach((v, i) => {
        const c = cols[i];
        const larg = (cols[i + 1]?.x ?? W - M) - c.x - 10;
        if (c.dir) direita(v, c.x, y, 9, i === 0 ? negrito : normal);
        else texto(i === 0 ? cortar(v, larg, 9, negrito) : v, c.x, y, 9, i === 0 ? negrito : normal);
      });
      y -= 17;
    }
    if (!linhas.length) { texto("Nada registrado.", M, y, 8.5, normal, CINZA); y -= 16; }
  };

  if (r.tipo === "festa") {
    tabela("POR LOTE",
      [{ t: "LOTE", x: M }, { t: "PAGOS", x: 268 }, { t: "CORTESIA", x: 340 }, { t: "FATURADO", x: W - M, dir: true }],
      r.lotes.map((l) => [l.nome, num(l.pagos), num(l.cortesias), brl(l.faturado)]));
  } else {
    tabela("POR FESTA",
      [{ t: "FESTA", x: M }, { t: "DATA", x: 270 }, { t: "INGRESSOS", x: 340 }, { t: "ENTRARAM", x: 410 }, { t: "FATURADO", x: W - M, dir: true }],
      r.festas.map((f) => [f.titulo, new Date(f.data).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" }), num(f.ingressos), num(f.entraram), brl(f.faturado)]));
  }

  return doc.save();
}
