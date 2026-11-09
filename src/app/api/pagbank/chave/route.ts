import { NextResponse } from "next/server";
import { modoDemo } from "@/lib/env";
import { chavePublicaCartao } from "@/lib/pagbank";

export const dynamic = "force-dynamic";

/** Chave pública para criptografar o cartão no navegador (o número nunca passa pelo nosso servidor). */
export async function GET() {
  if (modoDemo()) return NextResponse.json({ demo: true });
  try {
    return NextResponse.json({ chave: await chavePublicaCartao() });
  } catch {
    return NextResponse.json({ erro: "Cartão indisponível no momento." }, { status: 502 });
  }
}
