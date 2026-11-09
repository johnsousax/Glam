"use client";
export function Imprimir() {
  return <button onClick={() => window.print()} className="btn-ouro ouro-gradiente">Salvar em PDF / imprimir</button>;
}
