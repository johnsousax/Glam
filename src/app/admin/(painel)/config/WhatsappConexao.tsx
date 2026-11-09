"use client";
import { useCallback, useEffect, useState } from "react";
import { whatsappAcao, type SituacaoWhatsapp } from "../../acoes";

const NOMES: Record<string, string> = { conectado: "Conectado", aguardando_qr: "Aguardando leitura do QR", desconectado: "Desconectado", nao_conectado: "Não conectado", erro: "Erro" };

export function WhatsappConexao() {
  const [s, setS] = useState<SituacaoWhatsapp | null>(null);
  const [carregando, setCarregando] = useState(false);
  const rodar = useCallback(async (acao: "conectar" | "status" | "desconectar") => {
    setCarregando(true);
    const r = await whatsappAcao(acao);
    setS((antes) => (acao === "status" && antes?.base64 && r.status !== "conectado" ? { ...r, base64: antes.base64 } : r));
    setCarregando(false);
  }, []);
  useEffect(() => { rodar("status"); }, [rodar]);
  // Enquanto o QR estiver na tela, confere a cada 5 s se já conectou
  useEffect(() => {
    if (s?.status !== "aguardando_qr") return;
    const t = setInterval(() => rodar("status"), 5000);
    return () => clearInterval(t);
  }, [s?.status, rodar]);

  const conectado = s?.status === "conectado";
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
      {s?.base64 && !conectado && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.base64.startsWith("data:") ? s.base64 : `data:image/png;base64,${s.base64}`} alt="QR Code do WhatsApp" className="h-60 w-60 rounded-xl bg-white p-2" />
          <p className="text-center text-xs text-fumaca">No celular da GLAM: WhatsApp › Aparelhos conectados › Conectar aparelho › aponte para o QR.</p>
        </div>
      )}
      {s?.erro && <p className="mt-3 text-sm text-perigo">{s.erro}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!conectado && <button disabled={carregando} onClick={() => rodar("conectar")} className="btn-ouro ouro-gradiente">{carregando ? "Aguarde…" : "Conectar WhatsApp (gerar QR)"}</button>}
        <button disabled={carregando} onClick={() => rodar("status")} className="btn-linha">Atualizar</button>
        {conectado && <button disabled={carregando} onClick={() => { if (confirm("Desconectar o WhatsApp da GLAM?")) rodar("desconectar"); }} className="btn-linha !text-perigo">Desconectar</button>}
      </div>
    </section>
  );
}
