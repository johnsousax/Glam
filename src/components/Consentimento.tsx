"use client";
import { useEffect, useState } from "react";

const CHAVE = "glam-consentimento-v1";

function carregarPixel(id: string) {
  if ((window as any).fbq || !id) return;
  const n: any = function (...args: unknown[]) { n.callMethod ? n.callMethod(...args) : n.queue.push(args); };
  (window as any).fbq = n; (window as any)._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  const s = document.createElement("script");
  s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  n("init", id); n("track", "PageView");
}

/** Banner LGPD: o Pixel da Meta só carrega depois do "Aceitar". Recusar é tão fácil quanto aceitar. */
export function Consentimento({ pixelId }: { pixelId: string }) {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    if (/^\/(admin|portaria)/.test(location.pathname)) return; // nada de pixel na área da equipe
    let v: string | null = null;
    try { v = localStorage.getItem(CHAVE); } catch {}
    if (v === "aceito") carregarPixel(pixelId);
    else if (!v) setMostrar(true);
  }, [pixelId]);
  const decidir = (aceito: boolean) => {
    try { localStorage.setItem(CHAVE, aceito ? "aceito" : "recusado"); localStorage.setItem(CHAVE + "-em", new Date().toISOString()); } catch {}
    setMostrar(false);
    if (aceito) carregarPixel(pixelId);
  };
  if (!mostrar) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border border-linha bg-carvao/95 p-4 text-sm text-fumaca shadow-2xl backdrop-blur sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <p>Usamos cookies essenciais para o site funcionar e, com sua permissão, cookies de marketing (Meta) para medir anúncios. <a href="/privacidade" className="text-ouro underline">Saiba mais</a>.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => decidir(false)} className="btn-linha flex-1 !py-2">Recusar</button>
        <button onClick={() => decidir(true)} className="btn-ouro ouro-gradiente flex-1 !py-2">Aceitar</button>
      </div>
    </div>
  );
}
