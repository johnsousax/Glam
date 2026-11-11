import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-admin";
import { soDigitos } from "@/lib/format";
import { traduzirErro } from "@/lib/pedidos";
import { salvarCliente } from "@/lib/clientes";
import { hmac } from "@/lib/crypto";
import { CriarPedido, lerCorpo } from "@/lib/esquemas";
import { dentroDoLimite, falhaInterna, ipDe, logSeguranca, origemValida, respostaLimite, turnstileOk } from "@/lib/seguranca";
import { novoAcesso, nomeCookiePedido, opcoesCookiePedido } from "@/lib/acesso-pedido";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!origemValida(req)) return NextResponse.json({ erro: "Requisição inválida." }, { status: 403 });
  const ip = ipDe(req.headers);
  const [livre, b] = await Promise.all([dentroDoLimite(`pedido:ip:${ip}`, 20, 3600), lerCorpo(req, CriarPedido, 64_000)]);
  if (!livre) return respostaLimite();
  if (!b) return NextResponse.json({ erro: "Dados inválidos. Confira os campos." }, { status: 400 });
  if (b.site) { logSeguranca("honeypot", { rota: "pedidos", ip }); return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 }); }

  // Robô + antifraude (limite por CPF e por WhatsApp por hora), tudo ao mesmo tempo
  const cpfHash = hmac(soDigitos(b.cliente.cpf));
  const [humano, cpfOk, telOk] = await Promise.all([
    turnstileOk(b.turnstile, ip),
    dentroDoLimite(`pedido:cpf:${cpfHash}`, 8, 3600),
    dentroDoLimite(`pedido:tel:${soDigitos(b.cliente.whatsapp)}`, 8, 3600),
  ]);
  if (!humano) return NextResponse.json({ erro: "Confirme que você não é um robô." }, { status: 400 });
  if (!cpfOk || !telOk) return respostaLimite();

  try {
    const clienteId = await salvarCliente(b.cliente);
    const acesso = novoAcesso();
    const { data, error } = await db().rpc("glam_criar_pedido_v2", {
      p_festa_id: b.festa_id,
      p_cliente_id: clienteId,
      p_itens: b.itens.map((i) => ({ lote_id: i.lote_id, quantidade: i.quantidade, nomes: i.nomes || [] })),
      p_cupom: b.cupom || null,
      p_promoter: b.promoter || null,
      p_canal: "site",
      p_metodo: null,
      p_staff_id: null,
      p_ignorar_janela: false,
      p_idempotencia: b.idempotencia,
      p_acesso_hash: acesso.hash,
    });
    if (error) {
      const msg = error.message.startsWith("MUITAS_RESERVAS") ? "Você já tem reservas abertas. Pague ou aguarde elas expirarem." : traduzirErro(error.message);
      return NextResponse.json({ erro: msg }, { status: 409 });
    }
    const r = data as { id: string; total: number; repetido?: boolean };
    const res = NextResponse.json({ id: r.id, total: r.total });
    if (!r.repetido) res.cookies.set(nomeCookiePedido(r.id), acesso.token, opcoesCookiePedido);
    return res;
  } catch (e) {
    const f = falhaInterna("criar_pedido", e);
    return NextResponse.json({ erro: f.mensagem }, { status: 500 });
  }
}
