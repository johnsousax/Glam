"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { brl } from "@/lib/format";

declare global { interface Window { PagSeguro?: any } }

function useRelogio(expiraEm: string) {
  const [resta, setResta] = useState(() => Math.max(0, +new Date(expiraEm) - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setResta(Math.max(0, +new Date(expiraEm) - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiraEm]);
  const m = Math.floor(resta / 60000), s = Math.floor((resta % 60000) / 1000);
  return { resta, texto: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

export function Pagamento({ pedidoId, expiraEm, demo, cartao, nomeCliente, totalCentavos, taxaCartao }: { pedidoId: string; expiraEm: string; demo: boolean; cartao: boolean; nomeCliente: string; totalCentavos: number; taxaCartao: number }) {
  const router = useRouter();
  const relogio = useRelogio(expiraEm);
  const [aba, setAba] = useState<"pix" | "cartao">("pix");
  const [pix, setPix] = useState<{ copia_cola: string; qr: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const pedido = useRef(false);

  // Consulta o status a cada 4s
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/pedidos/${pedidoId}`, { cache: "no-store" });
        const j = await r.json();
        if (j.status && j.status !== "pendente") { clearInterval(t); router.refresh(); }
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [pedidoId, router]);

  useEffect(() => { if (relogio.resta === 0) router.refresh(); }, [relogio.resta, router]);

  const gerarPix = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const r = await fetch(`/api/pedidos/${pedidoId}/pagar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ metodo: "pix" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      if (j.status === "pago") return router.refresh();
      const qr = j.qr_url || (await QRCode.toDataURL(j.copia_cola, { width: 360, margin: 1 }));
      setPix({ copia_cola: j.copia_cola, qr });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar Pix.");
    } finally { setCarregando(false); }
  }, [pedidoId, router]);

  useEffect(() => { if (aba === "pix" && !pix && !pedido.current) { pedido.current = true; gerarPix(); } }, [aba, pix, gerarPix]);

  async function copiar() {
    if (!pix) return;
    await navigator.clipboard.writeText(pix.copia_cola);
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  }

  async function simular() {
    setCarregando(true);
    await fetch(`/api/pedidos/${pedidoId}/simular`, { method: "POST" });
    router.refresh();
  }

  return (
    <section className="surge space-y-5" style={{ animationDelay: ".2s" }}>
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className="text-fumaca">Seu ingresso está reservado por</span>
        <span className={`rounded-full border px-3 py-1 font-semibold tabular-nums ${relogio.resta < 120000 ? "border-perigo/60 text-perigo" : "border-ouro/50 text-ouro"}`}>{relogio.texto}</span>
      </div>

      {cartao && <div className="grid grid-cols-2 gap-2 rounded-full border border-linha bg-carvao p-1">
        {(["pix", "cartao"] as const).map((a) => (
          <button key={a} onClick={() => { setAba(a); setErro(null); }} className={`rounded-full py-2.5 text-xs font-semibold uppercase tracking-[0.25em] transition ${aba === a ? "ouro-gradiente text-noir" : "text-fumaca hover:text-marfim"}`}>
            {a === "pix" ? "Pix" : "Cartão"}
          </button>
        ))}
      </div>}

      {demo && (
        <p className="rounded-xl border border-ouro/30 bg-ouro/5 px-4 py-3 text-center text-xs text-ouro-claro">
          Modo demonstração: nenhum meio de pagamento foi conectado ainda. Nenhuma cobrança real é feita.
        </p>
      )}

      {aba === "pix" ? (
        <div className="cartao space-y-5 p-6 text-center">
          {carregando && !pix && <p className="py-10 text-sm text-fumaca">Gerando seu Pix…</p>}
          {pix && (
            <>
              <div className="mx-auto w-fit rounded-2xl bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pix.qr} alt="QR Code Pix" className="h-56 w-56" />
              </div>
              <p className="text-sm text-fumaca">Abra o app do seu banco, escolha <b className="text-marfim">Pix › Ler QR code</b> ou use o copia e cola:</p>
              <div className="break-all rounded-xl border border-linha bg-noir/60 p-3 text-left font-mono text-[0.7rem] text-fumaca">{pix.copia_cola}</div>
              <button onClick={copiar} className="btn-ouro ouro-gradiente w-full">{copiado ? "Copiado ✓" : "Copiar código Pix"}</button>
              <p className="flex items-center justify-center gap-2 text-xs text-fumaca">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-ouro" /> Aguardando o pagamento… esta tela atualiza sozinha.
              </p>
              {demo && <button onClick={simular} disabled={carregando} className="btn-linha w-full">Simular pagamento aprovado</button>}
              {cartao && taxaCartao > 0 && <p className="text-xs text-sucesso">No Pix você não paga taxa.</p>}
            </>
          )}
          {erro && <p className="text-sm text-perigo">{erro} <button className="underline" onClick={gerarPix}>Tentar de novo</button></p>}
        </div>
      ) : (
        <Cartao pedidoId={pedidoId} demo={demo} nomeCliente={nomeCliente} totalCentavos={totalCentavos} taxaCartao={taxaCartao} onErro={setErro} onAviso={setAviso} erro={erro} aviso={aviso} />
      )}
    </section>
  );
}

function Cartao({ pedidoId, demo, nomeCliente, totalCentavos, taxaCartao, onErro, onAviso, erro, aviso }: { pedidoId: string; demo: boolean; nomeCliente: string; totalCentavos: number; taxaCartao: number; onErro: (s: string | null) => void; onAviso: (s: string | null) => void; erro: string | null; aviso: string | null }) {
  const router = useRouter();
  const [f, setF] = useState({ numero: "", validade: "", cvv: "", nome: nomeCliente.toUpperCase(), cpf: "" });
  const [enviando, setEnviando] = useState(false);
  const [chave, setChave] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    fetch("/api/pagbank/chave").then((r) => r.json()).then((j) => setChave(j.chave || null)).catch(() => {});
    if (!document.getElementById("pagseguro-sdk")) {
      const s = document.createElement("script");
      s.id = "pagseguro-sdk";
      s.src = "https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js";
      document.body.appendChild(s);
    }
  }, [demo]);

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    onErro(null); onAviso(null);
    const [mes, ano] = f.validade.split("/").map((x) => x.trim());
    let criptografado: string | null = null;
    if (!demo) {
      if (!window.PagSeguro || !chave) return onErro("Carregando o pagamento seguro… tente em alguns segundos.");
      const r = window.PagSeguro.encryptCard({
        publicKey: chave, holder: f.nome, number: f.numero.replace(/\D/g, ""), expMonth: mes, expYear: ano?.length === 2 ? `20${ano}` : ano, securityCode: f.cvv,
      });
      if (r.hasErrors) return onErro("Confira os dados do cartão.");
      criptografado = r.encryptedCard;
    }
    setEnviando(true);
    try {
      const r = await fetch(`/api/pedidos/${pedidoId}/pagar`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ metodo: "cartao", cartao_criptografado: criptografado, titular_nome: f.nome, titular_cpf: f.cpf, taxa_exibida: taxaCartao }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      if (j.status === "pago") return router.refresh();
      onAviso(j.mensagem || "Pagamento em análise.");
    } catch (e) {
      onErro(e instanceof Error ? e.message : "Erro no pagamento.");
    } finally { setEnviando(false); }
  }

  const num = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
  return (
    <form onSubmit={pagar} className="cartao space-y-4 p-6">
      <div><label className="rotulo">Número do cartão</label><input className="campo font-mono" inputMode="numeric" autoComplete="cc-number" value={f.numero} onChange={(e) => setF({ ...f, numero: num(e.target.value) })} required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="rotulo">Validade</label><input className="campo" placeholder="MM/AA" autoComplete="cc-exp" value={f.validade} onChange={(e) => setF({ ...f, validade: e.target.value.replace(/[^\d/]/g, "").replace(/^(\d{2})(\d)/, "$1/$2").slice(0, 7) })} required /></div>
        <div><label className="rotulo">CVV</label><input className="campo" inputMode="numeric" autoComplete="cc-csc" value={f.cvv} onChange={(e) => setF({ ...f, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} required /></div>
      </div>
      <div><label className="rotulo">Nome impresso no cartão</label><input className="campo uppercase" autoComplete="cc-name" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value.toUpperCase() })} required /></div>
      <div><label className="rotulo">CPF do titular</label><input className="campo" inputMode="numeric" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })} required /></div>
      {erro && <p className="rounded-xl border border-perigo/40 bg-perigo/10 px-4 py-3 text-sm text-perigo">{erro}</p>}
      {aviso && <p className="rounded-xl border border-ouro/40 bg-ouro/10 px-4 py-3 text-sm text-ouro-claro">{aviso}</p>}
      {taxaCartao > 0 && (
        <div className="space-y-1 rounded-xl border border-linha bg-noir/40 px-4 py-3 text-sm">
          <div className="flex justify-between text-fumaca"><span>Ingressos</span><span>{brl(totalCentavos)}</span></div>
          <div className="flex justify-between text-fumaca"><span>Taxa do cartão</span><span>{brl(taxaCartao)}</span></div>
          <div className="flex justify-between font-semibold text-marfim"><span>Total no cartão</span><span>{brl(totalCentavos + taxaCartao)}</span></div>
          <p className="pt-1 text-xs text-fumaca/80">Quer evitar a taxa? Pague com Pix.</p>
        </div>
      )}
      <button disabled={enviando} className="btn-ouro ouro-gradiente w-full !py-4">{enviando ? "Processando…" : `Pagar ${brl(totalCentavos + taxaCartao)} com cartão`}</button>
      <p className="text-center text-[0.65rem] uppercase tracking-[0.2em] text-fumaca/70">🔒 Cartão criptografado no seu aparelho pelo PagBank · à vista</p>
    </form>
  );
}
