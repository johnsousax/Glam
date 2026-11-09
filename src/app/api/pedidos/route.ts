import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { cpfValido, soDigitos } from "@/lib/format";
import { salvarCliente } from "@/lib/clientes";
import { traduzirErro } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

type Corpo = {
  festa_id: string;
  cliente: { nome: string; email: string; whatsapp: string; cpf: string };
  itens: { lote_id: string; quantidade: number; nomes?: string[] }[];
  cupom?: string | null;
  promoter?: string | null;
};

export async function POST(req: Request) {
  let b: Corpo;
  try { b = await req.json(); } catch { return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 }); }

  const c = b?.cliente;
  if (!b?.festa_id || !Array.isArray(b.itens) || !c) return NextResponse.json({ erro: "Dados incompletos." }, { status: 400 });
  if (!c.nome || c.nome.trim().length < 3) return NextResponse.json({ erro: "Informe seu nome completo." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(c.email || "")) return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  if (soDigitos(c.whatsapp).length < 10) return NextResponse.json({ erro: "WhatsApp inválido." }, { status: 400 });
  if (!cpfValido(c.cpf)) return NextResponse.json({ erro: "CPF inválido." }, { status: 400 });
  if (b.itens.length > 10) return NextResponse.json({ erro: "Itens demais." }, { status: 400 });

  const itens = b.itens.map((i) => ({
    lote_id: String(i.lote_id),
    quantidade: Math.floor(Number(i.quantidade)),
    nomes: (i.nomes || []).slice(0, 200).map((n) => String(n || "").trim().slice(0, 80)),
  }));

  try {
    const clienteId = await salvarCliente(c);
    const { data, error } = await db().rpc("glam_criar_pedido", {
      p_festa_id: b.festa_id,
      p_cliente_id: clienteId,
      p_itens: itens,
      p_cupom: b.cupom || null,
      p_promoter: b.promoter || null,
      p_canal: "site",
      p_metodo: null,
      p_staff_id: null,
      p_ignorar_janela: false,
    });
    if (error) return NextResponse.json({ erro: traduzirErro(error.message) }, { status: 409 });
    return NextResponse.json(data);
  } catch (e) {
    console.error("criar pedido", e);
    return NextResponse.json({ erro: "Não foi possível reservar agora. Tente novamente." }, { status: 500 });
  }
}
