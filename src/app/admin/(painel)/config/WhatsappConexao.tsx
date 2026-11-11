"use client";
import { useCallback, useEffect, useState } from "react";
import { whatsappAcao, type SituacaoWhatsapp } from "../../acoes";

const NOMES: Record<string, string> = { conectado: "Conectado", aguardando_qr: "Aguardando conexão", desconectado: "Desconectado", nao_conectado: "Não conectado", erro: "Erro" };
type Modo = "qr" | "codigo";

/** "98 98584-0529" → mostra bonito; o servidor normaliza e põe o 55. */
const mostrarNumero = (v: string) => { const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""); return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : v; };

export function WhatsappConexao({ numeroCasa = "" }: { numeroCasa?: string }) {
  const [s, setS] = useState<SituacaoWhatsapp | null>(null);
  const [modo, setModo] = useState<Modo>("qr");
  const [numero, setNumero] = useState(mostrarNumero(numeroCasa));
  const [carregando, setCarregando] = useState(false);
  const rodar = useCallback(async (acao: "conectar" | "codigo" | "status" | "desconectar", num?: string) => {
    setCarregando(true);
    const r = await whatsappAcao(acao, num);
    // Na consulta de status, mantém o QR/código que já está na tela até conectar
    setS((antes) => (acao === "status" && (antes?.base64 || antes?.codigo) && r.status !== "conectado" ? { ...r, status: "aguardando_qr", base64: antes.base64, codigo: antes.codigo } : r));
    setCarregando(false);
  }, []);
  useEffect(() => { rodar("status"); }, [rodar]);
  // Enquanto espera: confere a cada 5 s se já conectou. No modo QR, pede um QR
  // novo a cada 25 s (o WhatsApp invalida em ~40 s). O código manual não é
  // renovado sozinho para não mudar enquanto a pessoa digita.
  useEffect(() => {
    if (s?.status !== "aguardando_qr") return;
    const status = setInterval(() => rodar("status"), 5000);
    const novo = modo === "qr" && s.base64 ? setInterval(() => rodar("conectar"), 25000) : null;
    return () => { clearInterval(status); if (novo) clearInterval(novo); };
  }, [s?.status, s?.base64, modo, rodar]);

  const conectado = s?.status === "conectado";
  const codigo = s?.codigo ? s.codigo.replace(/[^A-Z0-9]/gi, "").toUpperCase() : "";
  const trocar = (m: Modo) => { setModo(m); setS((x) => (x && !conectado ? { ...x, base64: undefined, codigo: undefined, erro: undefined, status: x.status === "aguardando_qr" ? "nao_conectado" : x.status } : x)); };

  return (
    <section className="cartao mb-6 max-w-4xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ouro">WhatsApp da casa</p>
          <p className="mt-1 text-sm text-fumaca">Número que envia ingressos, lembretes e avisos aos clientes.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${conectado ? "border-sucesso/50 text-sucesso" : "border-linha text-fumaca"}`}>
          {s ? NOMES[s.status] || s.status : "Consultando…"}
        </span>
      </div>

      {conectado && <p className="mt-3 text-sm text-marfim">Conectado{s?.numero ? ` ao +${s.numero}` : ""}{s?.perfil ? ` (${s.perfil})` : ""}.</p>}

      {!conectado && (
        <>
          <div className="mt-4 inline-flex rounded-xl border border-linha p-1 text-sm">
            <button type="button" onClick={() => trocar("qr")} className={`rounded-lg px-4 py-2 ${modo === "qr" ? "bg-marfim/10 text-marfim" : "text-fumaca"}`}>Ler QR Code</button>
            <button type="button" onClick={() => trocar("codigo")} className={`rounded-lg px-4 py-2 ${modo === "codigo" ? "bg-marfim/10 text-marfim" : "text-fumaca"}`}>Digitar código</button>
          </div>

          {modo === "qr" && s?.base64 && (
            <div className="mt-4 flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.base64.startsWith("data:") ? s.base64 : `data:image/png;base64,${s.base64}`} alt="QR Code do WhatsApp" className="h-72 w-72 max-w-full rounded-xl bg-white p-3" />
              <p className="text-center text-sm text-fumaca">No celular da GLAM: WhatsApp › ⋮ › Aparelhos conectados › Conectar aparelho › aponte para o QR.<br /><span className="text-xs">O código se renova sozinho a cada 25 segundos.</span></p>
            </div>
          )}

          {modo === "codigo" && (
            <div className="mt-4 space-y-3">
              <div className="max-w-xs">
                <label className="rotulo">Número do WhatsApp da casa</label>
                <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" placeholder="(98) 98584-0529" className="campo" />
              </div>
              {codigo && (
                <div className="rounded-2xl border border-ouro/40 bg-ouro/5 p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-ouro">Código de conexão</p>
                  <p className="mt-2 select-all font-mono text-4xl font-semibold tracking-[0.25em] text-marfim">{codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo}</p>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(codigo)} className="btn-linha mt-3 !py-1.5 text-xs">Copiar código</button>
                </div>
              )}
              <ol className="list-decimal space-y-1 pl-5 text-sm text-fumaca">
                <li>No celular da GLAM, abra o WhatsApp › ⋮ (ou Configurações no iPhone) › <b>Aparelhos conectados</b> › <b>Conectar aparelho</b>.</li>
                <li>Toque em <b>“Conectar com número de telefone”</b> (embaixo da câmera).</li>
                <li>Digite o código de 8 letras/números que aparece aqui. Ele vale por poucos minutos — se expirar, gere outro.</li>
              </ol>
            </div>
          )}
        </>
      )}

      {s?.erro && <p className="mt-3 text-sm text-perigo">{s.erro}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!conectado && modo === "qr" && <button disabled={carregando} onClick={() => rodar("conectar")} className="btn-ouro ouro-gradiente">{carregando ? "Aguarde…" : "Gerar QR Code"}</button>}
        {!conectado && modo === "codigo" && <button disabled={carregando} onClick={() => rodar("codigo", numero)} className="btn-ouro ouro-gradiente">{carregando ? "Aguarde…" : codigo ? "Gerar novo código" : "Gerar código"}</button>}
        <button disabled={carregando} onClick={() => rodar("status")} className="btn-linha">Atualizar</button>
        {conectado && <button disabled={carregando} onClick={() => { if (confirm("Desconectar o WhatsApp da GLAM?")) rodar("desconectar"); }} className="btn-linha !text-perigo">Desconectar</button>}
      </div>
    </section>
  );
}
