"use client";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const FRASE = ["a", "casinha", "mais", "amada", "de", "São", "Luís"];

// Já tocou nesta abertura do site? (vale enquanto a página não é recarregada)
let jaTocou = false;

/** Decide no navegador, sem piscar: toca ao entrar no site pela página inicial (link, digitando ou recarregando)
 *  e ao tocar no logo do topo; não repete ao voltar de uma festa. */
function deveTocar(forcar: boolean) {
  if (forcar) return true;
  if (typeof window === "undefined") return true; // servidor: a página inicial sempre sai com a abertura
  if (jaTocou) return false;
  // Entrou direto em outra página (ex.: link da festa) e depois veio para a inicial: não toca
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  try { return !nav || new URL(nav.name).pathname === "/"; } catch { return true; }
}

export function Intro({ forcar = false }: { forcar?: boolean }) {
  const [fase, setFase] = useState<"mostra" | "sai" | "oculta">(() => (deveTocar(forcar) ? "mostra" : "oculta"));

  useEffect(() => {
    if (fase === "oculta") { jaTocou = true; return; }
    jaTocou = true;
    if (location.search.includes("abertura=")) history.replaceState(null, "", "/");
    document.documentElement.style.overflow = "hidden";
    const t1 = setTimeout(() => setFase("sai"), 4000);
    const t2 = setTimeout(() => { setFase("oculta"); document.documentElement.style.overflow = ""; }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); document.documentElement.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (fase === "oculta") return null;

  const pular = () => {
    setFase("sai");
    setTimeout(() => { setFase("oculta"); document.documentElement.style.overflow = ""; }, 900);
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-noir ${fase === "sai" ? "intro-sai" : ""}`} onClick={pular} aria-label="Abertura GLAM (toque para entrar)" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") pular(); }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="particula" style={{ left: `${(i * 37 + 9) % 100}%`, bottom: `-${(i * 13) % 20}px`, animationDuration: `${6 + (i % 5)}s`, animationDelay: `${(i % 6) * 0.45}s` }} />
      ))}
      <div className="relative flex flex-col items-center px-6 text-center">
        <Logo dourado className="intro-logo w-[min(70vw,400px)]" />
        <div className="intro-raio linha-dourada mt-8 w-[min(80vw,480px)] origin-center" />
        <p className="intro-frase mt-7 whitespace-nowrap font-display text-[clamp(0.8rem,3.6vw,2rem)] font-semibold uppercase leading-tight tracking-[0.04em] text-marfim/90">
          {FRASE.map((p, i) => (
            <span key={i} style={{ animationDelay: `${1.4 + i * 0.15}s` }} className={p === "amada" ? "texto-ouro" : ""}>{p}{i < FRASE.length - 1 ? "\u00a0" : ""}</span>
          ))}
        </p>
      </div>
    </div>
  );
}
