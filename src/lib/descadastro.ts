import "server-only";
import { hmac } from "./crypto";
import { iguaisSeguro } from "./seguranca";

/** Link de "não quero mais receber": id do cliente + assinatura (não dá para descadastrar outra pessoa). */
export function tokenDescadastro(clienteId: string) {
  return `${clienteId}.${hmac(`descadastro:${clienteId}`).slice(0, 32)}`;
}
export function lerTokenDescadastro(t: string | null | undefined): string | null {
  if (!t) return null;
  const [id, sig] = t.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return iguaisSeguro(sig, hmac(`descadastro:${id}`).slice(0, 32)) ? id : null;
}
