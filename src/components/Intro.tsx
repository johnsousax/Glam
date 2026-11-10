"use client";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const FRASE = ["a", "casinha", "mais", "amada", "de", "São", "Luís"];

/** Abertura: toca uma vez por visita (cookie de sessão) ou quando tocam no logo do topo; depois some sozinha. */
export function Intro() {
  const [fase, setFase] = useState<"mostra" | "sai" | "oculta">("mostra");

  useEffect(() => {
    document.cookie = "glam_abertura=1; path=/; SameSite=Lax; Secure";
    if (location.search.includes("abertura=")) history.replaceState(null, "", "/");
    document.documentElement.style.overflow = "hidden";
    const t1 = setTimeout(() => setFase("sai"), 4000);
    const t2 = setTimeout(() => { setFase("oculta"); document.documentElement.style.overflow = ""; }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); document.documentElement.style.overflow = ""; };
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
        <p className="intro-frase mt-7 font-display text-[clamp(1.5rem,5vw,2.5rem)] italic leading-tight text-marfim/90">
          {FRASE.map((p, i) => (
            <span key={i} style={{ animationDelay: `${1.4 + i * 0.15}s` }} className={p === "amada" ? "texto-ouro" : ""}>{p}&nbsp;</span>
          ))}
        </p>
      </div>
    </div>
  );
}
