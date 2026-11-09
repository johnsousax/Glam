"use client";
import { useEffect } from "react";
export function RastreioCompra({ valor }: { valor: number }) {
  useEffect(() => { try { (window as any).fbq?.("track", "Purchase", { value: valor, currency: "BRL" }); } catch {} }, [valor]);
  return null;
}
