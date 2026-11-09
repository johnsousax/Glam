import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";
import { env } from "./env";

// Duas subchaves independentes derivadas do segredo: uma cifra, outra só para o índice cego (HMAC)
function base() {
  if (!env.cpfKey || env.cpfKey.length < 32) throw new Error("Configure CPF_ENCRYPTION_KEY (32+ caracteres)");
  return env.cpfKey;
}
function chave() {
  return createHash("sha256").update("glam:cifra:v1:" + base()).digest();
}
function chaveIndice() {
  return createHash("sha256").update("glam:indice:v1:" + base()).digest();
}

/** AES-256-GCM: v1.iv.tag.dados (base64url) */
export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return "v1." + [iv, c.getAuthTag(), dados].map((b) => b.toString("base64url")).join(".");
}

export function decifrar(payload: string) {
  const partes = payload.split(".");
  if (partes[0] !== "v1" || partes.length !== 4) throw new Error("payload inválido");
  const [iv, tag, dados] = partes.slice(1).map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}

export function hmac(texto: string) {
  return createHmac("sha256", chaveIndice()).update(texto).digest("hex");
}

export function sha256(texto: string) {
  return createHash("sha256").update(texto).digest("hex");
}

export function tokenAleatorio(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
