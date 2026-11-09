import "server-only";
import { db } from "./supabase-admin";
import { cifrar, hmac } from "./crypto";
import { normalizarWhatsapp, soDigitos } from "./format";

export type DadosCliente = { nome: string; email: string; whatsapp?: string | null; cpf?: string | null };

/** Upsert do cliente com CPF criptografado. */
export async function salvarCliente(c: DadosCliente) {
  const email = c.email.trim().toLowerCase();
  const cpf = soDigitos(c.cpf);
  const linha: Record<string, string> = { nome: c.nome.trim().slice(0, 120), email, atualizado_em: new Date().toISOString() };
  if (c.whatsapp) linha.whatsapp = normalizarWhatsapp(c.whatsapp);
  if (cpf) { linha.cpf_cifrado = cifrar(cpf); linha.cpf_hash = hmac(cpf); }
  const { data, error } = await db().from("glam_clientes").upsert(linha, { onConflict: "email" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

