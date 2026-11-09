import { db } from "@/lib/supabase-admin";
import { exigirStaff } from "@/lib/staff";
import { brl, dataHora } from "@/lib/format";
import { Titulo } from "@/components/admin/Titulo";

export const dynamic = "force-dynamic";

const NOMES: Record<string, string> = {
  pedido_cancelado: "Cancelou pedido", cortesia_emitida: "Deu cortesia", cortesia_lista: "Cortesia na lista", preco_alterado: "Mudou preço",
  venda_balcao: "Venda no balcão", festa_criada: "Criou festa", festa_editada: "Editou festa", lote_criado: "Criou lote", lote_editado: "Editou lote",
  lote_excluido: "Excluiu lote", lote_desativado: "Desativou lote", cupom_criado: "Criou cupom", cupom_ativado: "Ativou cupom", cupom_desativado: "Desativou cupom",
  membro_adicionado: "Adicionou à equipe", membro_alterado: "Alterou acesso", config_alterada: "Alterou configurações", ingressos_reenviados: "Reenviou ingressos",
  pagamento_confirmado_manual: "Confirmou pagamento manual", lista_adicionada: "Adicionou à lista", lista_removida: "Removeu da lista", ingresso_transferido: "Ingresso transferido",
  promoter_criado: "Criou promoter", promoter_editado: "Editou promoter", painel_configurado: "Configurou o painel",
};
const DESTAQUE = new Set(["pedido_cancelado", "cortesia_emitida", "cortesia_lista", "preco_alterado", "pagamento_confirmado_manual"]);

export default async function Auditoria({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await exigirStaff("auditoria");
  const { tipo } = await searchParams;
  let q = db().from("glam_auditoria").select("*").order("criado_em", { ascending: false }).limit(300);
  if (tipo === "sensiveis") q = q.in("acao", [...DESTAQUE]);
  const { data } = await q;
  return (
    <>
      <Titulo sup="Segurança" titulo="Registro de ações">
        <a href="/admin/auditoria" className="btn-linha">Tudo</a>
        <a href="/admin/auditoria?tipo=sensiveis" className="btn-linha">Cancelamentos, cortesias e preços</a>
      </Titulo>
      <div className="cartao divide-y divide-linha/60">
        {(data || []).map((a: any) => {
          const d = a.detalhes || {};
          const extra = a.acao === "preco_alterado" ? `${d.lote}: ${brl(d.de)} → ${brl(d.para)}` : a.acao === "pedido_cancelado" ? `${d.codigo} · ${brl(d.valor)} · ${d.motivo}` : d.codigo || d.titulo || d.lote || d.nome || d.quantidade ? [d.codigo, d.titulo, d.lote, d.nome, d.quantidade && `${d.quantidade} un.`].filter(Boolean).join(" · ") : "";
          return (
            <div key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-3 text-sm">
              <span className="w-32 shrink-0 text-xs text-fumaca">{dataHora(a.criado_em)}</span>
              <span className="w-36 shrink-0 text-marfim">{a.staff_nome}</span>
              <span className={DESTAQUE.has(a.acao) ? "text-ouro" : ""}>{NOMES[a.acao] || a.acao}</span>
              <span className="min-w-0 flex-1 truncate text-fumaca">{extra}</span>
            </div>
          );
        })}
        {(data || []).length === 0 && <p className="p-6 text-center text-fumaca">Nada registrado ainda.</p>}
      </div>
    </>
  );
}
