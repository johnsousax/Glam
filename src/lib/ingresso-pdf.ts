import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

/** Dados de um ingresso para o PDF (um PDF por pessoa). */
export type IngressoPdf = {
  nome: string; codigo: string; setor: string; lote: string;
  festa: string; data: string; hora: string; local?: string | null; endereco?: string | null; pedido: string;
};

// As fontes padrão do PDF só aceitam o alfabeto latino (com acentos); tira emoji e outros símbolos.
const limpo = (s: unknown) => String(s ?? "").normalize("NFC").replace(/[\u2013\u2014]/g, "-").replace(/[^ -~ -ÿ]/g, "").trim();

let logoCache: Uint8Array | null | undefined;
async function logo(siteUrl: string) {
  if (logoCache !== undefined) return logoCache;
  try {
    const r = await fetch(`${siteUrl}/logo-dourado.png`, { signal: AbortSignal.timeout(5000) });
    logoCache = r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch { logoCache = null; }
  return logoCache;
}

export async function gerarIngressoPdf(i: IngressoPdf, siteUrl: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Ingresso ${limpo(i.festa)} - ${limpo(i.nome)}`);
  doc.setAuthor("GLAM House");
  const W = 420, H = 640;
  const pg = doc.addPage([W, H]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const ouro = rgb(0.83, 0.69, 0.42), marfim = rgb(0.96, 0.94, 0.89), fumaca = rgb(0.64, 0.62, 0.57);

  pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.04, 0.035, 0.03) });
  pg.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: ouro });

  const centro = (t: string, y: number, tam: number, f = normal, cor = marfim) => {
    const txt = limpo(t);
    let s = tam;
    while (s > 9 && f.widthOfTextAtSize(txt, s) > W - 48) s -= 1;
    pg.drawText(txt, { x: (W - f.widthOfTextAtSize(txt, s)) / 2, y, size: s, font: f, color: cor });
  };

  const png = await logo(siteUrl);
  if (png) {
    try {
      const img = await doc.embedPng(png);
      const w = 120, h = (img.height / img.width) * w;
      pg.drawImage(img, { x: (W - w) / 2, y: H - 40 - h, width: w, height: h });
    } catch { centro("GLAM", H - 70, 30, negrito, ouro); }
  } else centro("GLAM", H - 70, 30, negrito, ouro);

  centro(i.festa, H - 120, 22, negrito);
  centro(`${i.data} · ${i.hora}`, H - 142, 11, normal, fumaca);
  if (i.local) centro(i.local + (i.endereco ? ` — ${i.endereco}` : ""), H - 158, 9, normal, fumaca);

  const qr = await QRCode.toBuffer(`GLAM:${i.codigo}`, { width: 600, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0908", light: "#ffffff" } });
  const qrImg = await doc.embedPng(new Uint8Array(qr));
  const lado = 230;
  pg.drawRectangle({ x: (W - lado) / 2 - 8, y: 196 - 8, width: lado + 16, height: lado + 16, color: rgb(1, 1, 1) });
  pg.drawImage(qrImg, { x: (W - lado) / 2, y: 196, width: lado, height: lado });

  centro(i.nome, 150, 20, negrito);
  centro(`${i.setor} · ${i.lote}`.toUpperCase(), 128, 11, negrito, ouro);
  centro(`Pedido ${i.pedido}`, 106, 9, normal, fumaca);

  pg.drawLine({ start: { x: 32, y: 86 }, end: { x: W - 32, y: 86 }, thickness: 0.5, color: rgb(0.23, 0.19, 0.13) });
  centro("Ingresso pessoal. Cada QR entra uma vez só — não compartilhe print.", 64, 8.5, normal, fumaca);
  centro("Apresente este QR na portaria com um documento.", 50, 8.5, normal, fumaca);
  centro("GLAM HOUSE · A CASINHA MAIS AMADA DE SÃO LUÍS", 24, 7.5, negrito, fumaca);

  return doc.save();
}

/** Nome de arquivo seguro: "Ingresso - Nome - Lote.pdf". */
export function nomeArquivo(i: IngressoPdf, n: number) {
  const base = limpo(`Ingresso ${n} - ${i.nome} - ${i.lote}`).replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").slice(0, 90);
  return `${base || `Ingresso ${n}`}.pdf`;
}
