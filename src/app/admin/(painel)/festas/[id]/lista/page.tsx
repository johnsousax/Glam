import { notFound } from "next/navigation";
import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { hora } from "@/lib/format";
import { Selo, Titulo } from "@/components/admin/Titulo";
import { SairPara } from "@/components/admin/Fechar";
import { FormAcao, Enviar, Confirmar } from "@/components/admin/ui";
import { adicionarLista, checkinLista, removerLista } from "../../../../acoes";

export const dynamic = "force-dynamic";

export default async function Lista({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  await exigirStaff("lista");
  const { id } = await params;
  const { q } = await searchParams;
  const { data: festa } = await db().from("glam_festas").select("titulo").eq("id", id).maybeSingle();
  if (!festa) notFound();
  let consulta = db().from("glam_lista").select("*, promoter:glam_promoters(nome)").eq("festa_id", id).order("nome").limit(1000);
  if (q) consulta = consulta.ilike("nome", `%${q}%`);
  const [{ data: nomes }, { data: promoters }] = await Promise.all([consulta, db().from("glam_promoters").select("id,nome").eq("ativo", true).order("nome")]);
  const total = nomes?.length || 0;
  const entraram = nomes?.filter((n: any) => n.checkin_em).length || 0;

  return (
    <>
      <Titulo sup={festa.titulo} titulo="Lista de nomes"><Selo cor="ouro">{entraram}/{total} entraram</Selo><SairPara href={`/admin/festas/${id}`} rotulo="Voltar para a festa" /></Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <form className="mb-4"><input name="q" defaultValue={q} placeholder="Buscar nome…" className="campo" /></form>
          <div className="cartao divide-y divide-linha/60">
            {(nomes || []).map((n: any) => (
              <div key={n.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${n.checkin_em ? "text-fumaca line-through" : ""}`}>{n.nome}</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.15em] text-fumaca">{n.tipo}{n.promoter ? ` · ${n.promoter.nome}` : ""}{n.checkin_em ? ` · entrou ${hora(n.checkin_em)}` : ""}</p>
                </div>
                <form action={checkinLista}>
                  <input type="hidden" name="id" value={n.id} />{n.checkin_em && <input type="hidden" name="desfazer" value="1" />}
                  <button className={n.checkin_em ? "text-xs text-fumaca underline" : "btn-ouro ouro-gradiente !px-4 !py-2"}>{n.checkin_em ? "Desfazer" : "Entrou"}</button>
                </form>
                <form action={removerLista}><input type="hidden" name="id" value={n.id} /><Confirmar mensagem={`Remover ${n.nome}?`} className="text-xs text-perigo">✕</Confirmar></form>
              </div>
            ))}
            {total === 0 && <p className="p-6 text-center text-fumaca">Lista vazia.</p>}
          </div>
        </div>
        <FormAcao acao={adicionarLista} limparAoSalvar className="cartao h-fit space-y-3 p-5">
          <input type="hidden" name="festa_id" value={id} />
          <p className="text-xs uppercase tracking-[0.3em] text-ouro">Adicionar nomes (até 1.000)</p>
          <textarea name="nomes" rows={10} className="campo" placeholder={"Um nome por linha\nMaria Silva\nJoão Souza"} required />
          <select name="tipo" className="campo" defaultValue="lista">
            <option value="lista">Lista</option><option value="vip">VIP</option><option value="aniversario">Aniversário</option><option value="promoter">Promoter</option><option value="cortesia">Cortesia</option>
          </select>
          <select name="promoter_id" className="campo" defaultValue=""><option value="">Sem promoter</option>{(promoters || []).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
          <Enviar className="btn-ouro ouro-gradiente w-full">Adicionar</Enviar>
        </FormAcao>
      </div>
    </>
  );
}
