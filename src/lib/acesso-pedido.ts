import "server-only";
import { cookies } from "next/headers";
import { sha256, tokenAleatorio } from "./crypto";
import { iguaisSeguro } from "./seguranca";

/** Token do comprador: só o navegador que fez o pedido vê os QR (cookie httpOnly). */
export function novoAcesso() {
  const token = tokenAleatorio(32);
  return { token, hash: sha256(token) };
}

export const nomeCookiePedido = (id: string) => `gp_${id.replace(/-/g, "")}`;

export const opcoesCookiePedido = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function compradorDoPedido(pedidoId: string, acessoHash: string | null | undefined) {
  if (!acessoHash) return false;
  const token = (await cookies()).get(nomeCookiePedido(pedidoId))?.value;
  return !!token && iguaisSeguro(sha256(token), acessoHash);
}
