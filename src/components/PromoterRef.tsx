"use client";
import { useEffect } from "react";

/** Guarda o código do promoter (?ref=) por 7 dias para creditar a comissão. */
export function PromoterRef() {
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) try { localStorage.setItem("glam-ref", JSON.stringify({ ref: ref.toLowerCase(), ate: Date.now() + 7 * 864e5 })); } catch {}
  }, []);
  return null;
}

export function lerPromoterRef(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem("glam-ref") || "null");
    return v && v.ate > Date.now() ? v.ref : null;
  } catch { return null; }
}
