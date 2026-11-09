import "server-only";
import { db } from "./supabase-admin";

export type ConfigCasa = {
  nome: string;
  slogan: string;
  cidade: string;
  endereco: string;
  instagram: string;
  whatsapp_casa: string;
  whatsapp_dono: string;
  email_dono: string;
  email_remetente: string;
  evolution_instancia: string;
  comissao_padrao: number;
};

const PADRAO: ConfigCasa = {
  nome: "GLAM House",
  slogan: "A casinha mais amada de São Luís",
  cidade: "São Luís / MA",
  endereco: "",
  instagram: "@glamhouse",
  whatsapp_casa: "5598985840529",
  whatsapp_dono: "",
  email_dono: "",
  email_remetente: "GLAM House <ingressos@glamhouse.com.br>",
  evolution_instancia: "glam",
  comissao_padrao: 10,
};

export async function configCasa(): Promise<ConfigCasa> {
  try {
    const { data } = await db().from("glam_config").select("valor").eq("chave", "casa").maybeSingle();
    return { ...PADRAO, ...(data?.valor || {}) };
  } catch {
    return PADRAO;
  }
}
