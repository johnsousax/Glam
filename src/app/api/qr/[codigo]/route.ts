import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/** PNG do QR do ingresso (usado no e-mail). O QR contém só o código aleatório. */
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(codigo)) return new Response("inválido", { status: 400 });
  const png = await QRCode.toBuffer(`GLAM:${codigo}`, { width: 520, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0908", light: "#ffffff" } });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
}
