import { z } from "zod";
import { cpfValido, soDigitos } from "./format";

// strictObject: campo desconhecido = requisição recusada (sem mass assignment)
const uuid = z.string().uuid();
const nome = z.string().trim().min(3).max(120);
const email = z.string().trim().toLowerCase().email().max(160);
const whatsapp = z.string().trim().max(25).refine((v) => soDigitos(v).length >= 10 && soDigitos(v).length <= 13, "WhatsApp inválido");
const cpf = z.string().trim().max(20).refine(cpfValido, "CPF inválido");

export const CriarPedido = z.strictObject({
  festa_id: uuid,
  cliente: z.strictObject({ nome, email, whatsapp, cpf }),
  itens: z.array(z.strictObject({
    lote_id: uuid,
    quantidade: z.number().int().min(1).max(50),
    nomes: z.array(z.string().trim().max(80)).max(200).optional(),
  })).min(1).max(10),
  cupom: z.string().trim().max(32).regex(/^[A-Za-z0-9_-]*$/).nullable().optional(),
  promoter: z.string().trim().max(40).regex(/^[a-z0-9_-]*$/i).nullable().optional(),
  idempotencia: z.string().uuid(),
  turnstile: z.string().max(4096).nullable().optional(),
  site: z.string().max(0).optional(), // honeypot: robô preenche, gente não vê
});

export const Pagar = z.discriminatedUnion("metodo", [
  z.strictObject({ metodo: z.literal("pix") }),
  z.strictObject({
    metodo: z.literal("cartao"),
    cartao_criptografado: z.string().max(4096).nullable(),
    titular_nome: z.string().trim().min(3).max(30),
    titular_cpf: cpf,
    /** Taxa do cartão que o cliente viu na tela (centavos). Se mudou, o servidor recusa e pede para recarregar. */
    taxa_exibida: z.number().int().min(0).max(10_000_000),
  }),
]);

export const Transferir = z.strictObject({
  nome,
  email,
  whatsapp: z.string().trim().max(25).optional().or(z.literal("")),
  email_atual: email,
});

export const PedirAcesso = z.strictObject({
  email,
  turnstile: z.string().max(4096).nullable().optional(),
  site: z.string().max(0).optional(),
});

export const Checkin = z.union([
  z.strictObject({ festa_id: uuid, codigo: z.string().max(60) }),
  z.strictObject({ festa_id: uuid, codigos: z.array(z.string().max(60)).min(1).max(500) }),
]);

export const ListaCheckin = z.strictObject({ id: uuid });

/** Lê o corpo JSON com teto de tamanho (1 MB) e valida no schema. */
export async function lerCorpo<T extends z.ZodTypeAny>(req: Request, schema: T, maxBytes = 1_000_000): Promise<z.infer<T> | null> {
  const tamanho = Number(req.headers.get("content-length") || 0);
  if (tamanho > maxBytes) return null;
  let texto: string;
  try { texto = await req.text(); } catch { return null; }
  if (texto.length > maxBytes) return null;
  let json: unknown;
  try { json = JSON.parse(texto); } catch { return null; }
  const r = schema.safeParse(json);
  return r.success ? r.data : null;
}
