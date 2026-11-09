export const TZ = "America/Sao_Paulo";

export function brl(centavos: number | null | undefined) {
  return ((centavos ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataLonga(iso: string | Date) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
}

export function dataCurta(iso: string | Date) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function hora(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function dataHora(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function diaMes(iso: string | Date) {
  const d = new Date(iso);
  return {
    dia: d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit" }),
    mes: d.toLocaleDateString("pt-BR", { timeZone: TZ, month: "short" }).replace(".", "").toUpperCase(),
    semana: d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short" }).replace(".", "").toUpperCase(),
  };
}

export function soDigitos(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}

/** Converte "AAAA-MM-DDTHH:mm" (horário de Brasília, vindo de input datetime-local) em ISO UTC. */
export function localParaIso(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/[zZ]|[+-]\d\d:\d\d$/.test(v)) return new Date(v).toISOString();
  return new Date(v + ":00-03:00").toISOString();
}

/** ISO -> valor para input datetime-local em horário de Brasília. */
export function isoParaLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function cpfValido(cpf: string) {
  const c = soDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += parseInt(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(c[9]) && calc(10) === parseInt(c[10]);
}

/** Normaliza WhatsApp brasileiro para 55DDDNÚMERO. */
export function normalizarWhatsapp(s: string) {
  let d = soDigitos(s);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}

export const SETORES: Record<string, string> = {
  pista: "Pista",
  vip: "VIP",
  camarote: "Camarote",
  mesa: "Mesa",
  meia: "Meia-entrada",
  backstage: "Backstage",
};
