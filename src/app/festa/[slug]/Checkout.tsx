"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { brl, cpfValido, SETORES } from "@/lib/format";
import type { SetorVitrine } from "@/lib/tipos";
import { lerPromoterRef } from "@/components/PromoterRef";

function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function mascaraTel(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function Checkout({ festaId, festaTitulo, setores }: { festaId: string; festaTitulo: string; setores: SetorVitrine[] }) {
  const router = useRouter();
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [nomes, setNomes] = useState<Record<string, string[]>>({});
  const [cliente, setCliente] = useState({ nome: "", email: "", whatsapp: "", cpf: "" });
  const [cupom, setCupom] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);

  const escolhidos = useMemo(
    () => setores.filter((s) => s.atual && (qtd[s.atual.id] || 0) > 0).map((s) => ({ setor: s.setor, lote: s.atual!, q: qtd[s.atual!.id] })),
    [setores, qtd]
  );
  const total = escolhidos.reduce((t, e) => t + e.q * e.lote.preco_centavos, 0);
  const pessoas = escolhidos.reduce((t, e) => t + e.q * e.lote.pessoas_por_unidade, 0);

  const alterar = (id: string, delta: number, max: number) =>
    setQtd((q) => ({ ...q, [id]: Math.max(0, Math.min(max, (q[id] || 0) + delta)) }));

  async function finalizar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!escolhidos.length) return setErro("Escolha ao menos um ingresso.");
    if (cliente.nome.trim().split(/\s+/).length < 2) return setErro("Informe seu nome completo.");
    if (!/^\S+@\S+\.\S+$/.test(cliente.email)) return setErro("E-mail inválido.");
    if (cliente.whatsapp.replace(/\D/g, "").length < 10) return setErro("WhatsApp inválido.");
    if (!cpfValido(cliente.cpf)) return setErro("CPF inválido.");
    if (!aceite) return setErro("Confirme que leu as condições de compra.");
    setEnviando(true);
    try {
      const r = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          festa_id: festaId,
          cliente,
          cupom: cupom.trim() || null,
          promoter: lerPromoterRef(),
          itens: escolhidos.map((e) => ({
            lote_id: e.lote.id,
            quantidade: e.q,
            nomes: (nomes[e.lote.id] || []).slice(0, e.q * e.lote.pessoas_por_unidade),
          })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Não foi possível reservar.");
      try { (window as any).fbq?.("track", "InitiateCheckout", { value: j.total / 100, currency: "BRL", content_name: festaTitulo }); } catch {}
      router.push(`/pedido/${j.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={finalizar} className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-[0.7rem] uppercase tracking-[0.4em] text-ouro">1 · Ingressos</h2>
        {setores.length === 0 && <p className="cartao p-6 text-sm text-fumaca">Nenhum lote cadastrado ainda.</p>}
        {setores.map((s) => {
          const l = s.atual;
          const q = l ? qtd[l.id] || 0 : 0;
          const max = l ? Math.min(l.max_por_pedido, l.disponivel) : 0;
          return (
            <div key={s.setor} className={`cartao p-5 transition ${q > 0 ? "!border-ouro/60" : ""}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[0.65rem] uppercase tracking-[0.3em] text-ouro">{SETORES[s.setor] || s.setor}</p>
                  {l ? (
                    <>
                      <p className="mt-1 font-display text-2xl text-marfim">{l.nome}</p>
                      <p className="text-xs text-fumaca">
                        {l.pessoas_por_unidade > 1 ? `Para ${l.pessoas_por_unidade} pessoas · ` : ""}
                        {l.descricao || ""}
                        {l.disponivel <= 10 && <span className="text-perigo"> · últimas {l.disponivel} unidades</span>}
                      </p>
                      {s.proximo && <p className="mt-1 text-[0.65rem] uppercase tracking-[0.15em] text-fumaca/70">Próximo: {s.proximo.nome} · {brl(s.proximo.preco_centavos)}</p>}
                    </>
                  ) : (
                    <p className="mt-1 font-display text-2xl text-fumaca">
                      {s.proximo ? `Em breve: ${s.proximo.nome}` : "Esgotado"}
                    </p>
                  )}
                </div>
                {l && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="texto-ouro text-lg font-semibold">{brl(l.preco_centavos)}</span>
                    <div className="flex items-center gap-3 rounded-full border border-linha bg-noir/60 p-1">
                      <button type="button" aria-label="Menos" onClick={() => alterar(l.id, -1, max)} className="h-8 w-8 rounded-full text-lg text-ouro hover:bg-ouro/10">−</button>
                      <span className="w-5 text-center font-semibold tabular-nums">{q}</span>
                      <button type="button" aria-label="Mais" onClick={() => alterar(l.id, 1, max)} className="h-8 w-8 rounded-full text-lg text-ouro hover:bg-ouro/10">+</button>
                    </div>
                  </div>
                )}
              </div>
              {l && q > 0 && (
                <div className="mt-4 grid gap-2 border-t border-linha pt-4 sm:grid-cols-2">
                  {Array.from({ length: q * l.pessoas_por_unidade }).map((_, i) => (
                    <input
                      key={i}
                      className="campo !py-2.5 text-sm"
                      placeholder={`Nome da pessoa ${i + 1}${i === 0 ? " (pode ser você)" : ""}`}
                      value={nomes[l.id]?.[i] || ""}
                      onChange={(e) => setNomes((n) => { const arr = [...(n[l.id] || [])]; arr[i] = e.target.value; return { ...n, [l.id]: arr }; })}
                      maxLength={80}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {escolhidos.length > 0 && (
        <section className="surge space-y-4">
          <h2 className="text-[0.7rem] uppercase tracking-[0.4em] text-ouro">2 · Seus dados</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="rotulo">Nome completo</label>
              <input className="campo" autoComplete="name" value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} required />
            </div>
            <div>
              <label className="rotulo">E-mail (o ingresso chega aqui)</label>
              <input className="campo" type="email" autoComplete="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} required />
            </div>
            <div>
              <label className="rotulo">WhatsApp</label>
              <input className="campo" inputMode="tel" autoComplete="tel" placeholder="(98) 90000-0000" value={cliente.whatsapp} onChange={(e) => setCliente({ ...cliente, whatsapp: mascaraTel(e.target.value) })} required />
            </div>
            <div>
              <label className="rotulo">CPF</label>
              <input className="campo" inputMode="numeric" placeholder="000.000.000-00" value={cliente.cpf} onChange={(e) => setCliente({ ...cliente, cpf: mascaraCpf(e.target.value) })} required />
            </div>
            <div>
              <label className="rotulo">Cupom (opcional)</label>
              <input className="campo uppercase" value={cupom} onChange={(e) => setCupom(e.target.value.toUpperCase())} maxLength={30} />
            </div>
          </div>

          <div className="cartao space-y-2 p-5">
            {escolhidos.map((e) => (
              <div key={e.lote.id} className="flex justify-between text-sm">
                <span className="text-fumaca">{e.q}× {SETORES[e.setor] || e.setor} · {e.lote.nome}</span>
                <span>{brl(e.q * e.lote.preco_centavos)}</span>
              </div>
            ))}
            <div className="linha-ouro !my-3 opacity-40" />
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-[0.25em] text-fumaca">Total · {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"}</span>
              <span className="texto-ouro font-display text-3xl font-semibold">{brl(total)}</span>
            </div>
            {cupom && <p className="text-right text-[0.7rem] text-fumaca">Desconto do cupom aplicado na próxima etapa.</p>}
          </div>

          <label className="flex items-start gap-3 text-xs leading-relaxed text-fumaca">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 accent-[#d4af6a]" />
            <span>Li e concordo: o ingresso é pessoal, cada QR entra uma vez só, e meus dados (CPF protegido com criptografia) são usados apenas para emitir e validar o ingresso, conforme a LGPD.</span>
          </label>

          {erro && <p className="rounded-xl border border-perigo/40 bg-perigo/10 px-4 py-3 text-sm text-perigo">{erro}</p>}

          <button disabled={enviando} className="btn-ouro ouro-gradiente w-full !py-4">
            {enviando ? "Reservando sua vaga…" : `Ir para o pagamento · ${brl(total)}`}
          </button>
          <p className="text-center text-[0.65rem] uppercase tracking-[0.25em] text-fumaca/70">Vaga reservada por 15 minutos · Pix ou cartão</p>
        </section>
      )}
      {escolhidos.length === 0 && erro && <p className="text-sm text-perigo">{erro}</p>}
    </form>
  );
}
