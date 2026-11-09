export function Titulo({ sup, titulo, children }: { sup?: string; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {sup && <p className="text-[0.65rem] uppercase tracking-[0.4em] text-ouro">{sup}</p>}
        <h1 className="mt-1 font-display text-4xl text-marfim">{titulo}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="cartao p-5">
      <p className="text-[0.65rem] uppercase tracking-[0.3em] text-fumaca">{rotulo}</p>
      <p className="mt-2 font-display text-3xl text-marfim">{valor}</p>
      {sub && <p className="mt-1 text-xs text-fumaca">{sub}</p>}
    </div>
  );
}

export function Selo({ cor = "fumaca", children }: { cor?: "ouro" | "sucesso" | "perigo" | "fumaca"; children: React.ReactNode }) {
  const c = { ouro: "border-ouro/50 text-ouro", sucesso: "border-sucesso/50 text-sucesso", perigo: "border-perigo/50 text-perigo", fumaca: "border-linha text-fumaca" }[cor];
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] ${c}`}>{children}</span>;
}

export const STATUS_PEDIDO: Record<string, { t: string; c: "ouro" | "sucesso" | "perigo" | "fumaca" }> = {
  pago: { t: "Pago", c: "sucesso" },
  pendente: { t: "Aguardando", c: "ouro" },
  expirado: { t: "Expirado", c: "fumaca" },
  cancelado: { t: "Cancelado", c: "perigo" },
  reembolsado: { t: "Reembolsado", c: "perigo" },
};
