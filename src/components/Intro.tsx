"use client";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const FRASE = ["a", "casinha", "mais", "amada", "de", "São", "Luís"];

/** Entrada cinematográfica: aparece na 1ª visita da sessão e some sozinha. */
export function Intro() {
  const [fase, setFase] = useState<"oculta" | "mostra" | "sai">("mostra");

  useEffect(() => {
    let visto = false;
    try { visto = sessionStorage.getItem("glam-intro") === "1"; } catch {}
    if (visto) { setFase("oculta"); return; }
    document.documentElement.style.overflow = "hidden";
    const t1 = setTimeout(() => setFase("sai"), 4300);
    const t2 = setTimeout(() => {
      setFase("oculta");
      document.documentElement.style.overflow = "";
      try { sessionStorage.setItem("glam-intro", "1"); } catch {}
    }, 5300);
    return () => { clearTimeout(t1); clearTimeout(t2); document.documentElement.style.overflow = ""; };
  }, []);

  if (fase === "oculta") return null;

  const pular = () => {
    setFase("sai");
    setTimeout(() => { setFase("oculta"); document.documentElement.style.overflow = ""; try { sessionStorage.setItem("glam-intro", "1"); } catch {} }, 900);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-noir ${fase === "sai" ? "intro-sai" : ""}`}
      onClick={pular}
      aria-label="Abertura GLAM"
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 50%, rgb(212 175 106 / .14), transparent 70%)" }} />
      {Array.from({ length: 26 }).map((_, i) => (
        <span key={i} className="particula" style={{ left: `${(i * 37) % 100}%`, bottom: `-${(i * 13) % 20}px`, animationDuration: `${5 + (i % 6)}s`, animationDelay: `${(i % 9) * 0.35}s` }} />
      ))}
      <div className="relative flex flex-col items-center px-6 text-center">
        <Logo className="intro-logo w-[min(72vw,440px)]" animado />
        <div className="intro-raio linha-ouro mt-8 w-[min(80vw,520px)] origin-center" />
        <p className="intro-frase mt-7 font-display text-[clamp(1.5rem,5vw,2.6rem)] italic leading-tight text-marfim/90">
          {FRASE.map((p, i) => (
            <span key={i} style={{ animationDelay: `${1.5 + i * 0.16}s` }} className={p === "amada" ? "texto-ouro brilho-ouro not-italic font-semibold" : ""}>
              {p}&nbsp;
            </span>
          ))}
        </p>
        <p className="surge mt-10 text-[0.65rem] uppercase tracking-[0.5em] text-fumaca" style={{ animationDelay: "2.9s" }}>
          Ingressos oficiais
        </p>
      </div>
      <button className="absolute bottom-8 text-[0.65rem] uppercase tracking-[0.35em] text-fumaca/70 hover:text-ouro">Pular</button>
    </div>
  );
}
