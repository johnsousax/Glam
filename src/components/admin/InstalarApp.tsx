"use client";
import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Botão "Instalar aplicativo": abre a instalação no Android e mostra o passo a passo no iPhone. */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [instalado, setInstalado] = useState(true); // só aparece depois de conferir no aparelho
  const [ajuda, setAjuda] = useState<"ios" | "android" | "pc" | null>(null);

  useEffect(() => {
    const emApp = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalado(emApp);
    const aoOferecer = (e: Event) => { e.preventDefault(); setEvento(e as EventoInstalar); };
    const aoInstalar = () => { setInstalado(true); setEvento(null); };
    window.addEventListener("beforeinstallprompt", aoOferecer);
    window.addEventListener("appinstalled", aoInstalar);
    return () => { window.removeEventListener("beforeinstallprompt", aoOferecer); window.removeEventListener("appinstalled", aoInstalar); };
  }, []);

  if (instalado) return null;

  async function instalar() {
    if (evento) {
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome === "accepted") setInstalado(true);
      setEvento(null);
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    setAjuda((a) => (a ? null : ios ? "ios" : /Android/.test(ua) ? "android" : "pc"));
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={instalar} className="btn-linha w-full">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>
        Instalar aplicativo
      </button>
      {ajuda && (
        <div className="mt-2 rounded-lg border border-linha bg-noir p-3 text-sm text-fumaca">
          {ajuda === "ios" && (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Abra esta página no <b className="text-marfim">Safari</b>.</li>
              <li>Toque em <b className="text-marfim">Compartilhar</b> (o quadrado com a seta para cima).</li>
              <li>Escolha <b className="text-marfim">Adicionar à Tela de Início</b> e confirme.</li>
            </ol>
          )}
          {ajuda === "android" && (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Abra esta página no <b className="text-marfim">Chrome</b>.</li>
              <li>Toque nos <b className="text-marfim">3 pontinhos</b> no canto de cima.</li>
              <li>Escolha <b className="text-marfim">Instalar aplicativo</b> (ou “Adicionar à tela inicial”).</li>
            </ol>
          )}
          {ajuda === "pc" && <p>No Chrome ou Edge, clique no ícone de <b className="text-marfim">instalar</b> no fim da barra de endereço.</p>}
        </div>
      )}
    </div>
  );
}
