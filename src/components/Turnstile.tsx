"use client";
import { useEffect } from "react";

/** Cloudflare Turnstile (anti-robô invisível). Só aparece se NEXT_PUBLIC_TURNSTILE_SITE_KEY estiver configurada. */
export function Turnstile() {
  const chave = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!chave || document.getElementById("cf-turnstile")) return;
    const s = document.createElement("script");
    s.id = "cf-turnstile";
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    document.head.appendChild(s);
  }, [chave]);
  if (!chave) return null;
  return <div className="cf-turnstile" data-sitekey={chave} data-theme="dark" data-size="flexible" />;
}

/** Lê o token gerado pelo widget dentro de um formulário controlado. */
export function tokenTurnstile(): string | null {
  const el = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
  return el?.value || null;
}
