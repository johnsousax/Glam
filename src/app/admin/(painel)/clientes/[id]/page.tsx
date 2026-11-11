import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { brl, dataCurta, dataHora } from "@/lib/format";
import { Kpi, Selo, STATUS_PEDIDO, Titulo } from "@/components/admin/Titulo";
import { SairPara } from "@/components/admin/Fechar";

export const dynamic = "force-dynamic";

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirStaff("clientes");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ data: c }, { data: pedidos }] = await Promise.all([
    db().from("glam_clientes").select("id,nome,email,whatsapp,aceita_marketing,marketing_em,descadastro_em,criado_em").eq("id", id).maybeSingle(),
    db().from("glam_pedidos").select("id,codigo,status,metodo,canal,total_centavos,criado_em,pago_em, festa:glam_festas(titulo,data_inicio), itens:glam_pedido_itens(quantidade, lote:glam_lotes(nome))").eq("cliente_id", id).order("criado_em", { ascending: false }).limit(200),
  ]);
  if (!c) notFound();
  const pagos = (pedidos || []).filter((p: any) => p.status === "pago");
  const total = pagos.reduce((t: number, p: any) => t + p.total_centavos, 0);
  const zap = (c.whatsapp || "").replace(/\D/g, "");

  return (
    <>
      <Titulo sup="Cliente" titulo={c.nome}>
        {zap && <a href={`https://wa.me/${zap}`} target="_blank" className="btn-linha">Chamar no WhatsApp ↗</a>}
        <a href={`mailto:${c.email}`} className="btn-linha">Enviar e-mail</a>
        <SairPara href="/admin/clientes" rotulo="Voltar para clientes" />
      </Titulo>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Compras pagas" valor={String(pagos.length)} />
        <Kpi rotulo="Total gasto" valor={brl(total)} />
        <Kpi rotulo="Cliente desde" valor={dataCurta(c.criado_em)} />
        <Kpi rotulo="Disparos" valor={c.aceita_marketing && !c.descadastro_em ? "Recebe" : "Saiu da lista"} sub={c.descadastro_em ? `Em ${dataCurta(c.descadastro_em)}` : undefined} />
      </div>
      <p className="mb-6 text-sm text-fumaca">{c.email}{c.whatsapp ? ` · ${c.whatsapp}` : ""}</p>
      <h2 className="mb-2 text-sm font-semibold">Histórico de pedidos</h2>
      <div className="cartao divide-y divide-linha">
        {(pedidos || []).map((p: any) => {
          const st = STATUS_PEDIDO[p.status];
          return (
            <Link key={p.id} href={`/admin/pedidos?q=${p.codigo}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-marfim/5">
              <div className="min-w-0">
                <p className="font-medium">{p.festa?.titulo} <span className="font-mono text-xs text-fumaca">{p.codigo}</span></p>
                <p className="text-xs text-fumaca">{p.itens.map((i: any) => `${i.quantidade}× ${i.lote?.nome}`).join(", ")} · {dataHora(p.criado_em)}</p>
              </div>
              <div className="flex items-center gap-3"><span>{brl(p.total_centavos)}</span>{st && <Selo cor={st.c}>{st.t}</Selo>}</div>
            </Link>
          );
        })}
        {(pedidos || []).length === 0 && <p className="p-6 text-center text-fumaca">Sem pedidos.</p>}
      </div>
    </>
  );
}
