import { NextResponse } from "next/server";
import { pagamentos } from "@/lib/gateways";
import { chavePublicaCartao } from "@/lib/pagbank";

export const dynamic = "force-dynamic";

/** Chave pública para criptografar o cartão no navegador (o número nunca passa pelo nosso servidor). */
export async function GET() {
  const pg = await pagamentos();
  if (pg.demo) return NextResponse.json({ demo: true });
  if (!pg.cartao) return NextResponse.json({ erro: "Cartão indisponível." }, { status: 404 });
  try {
    return NextResponse.json({ chave: await chavePublicaCartao() });
  } catch {
    return NextResponse.json({ erro: "Cartão indisponível no momento." }, { status: 502 });
  }
}
