import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";
import { env } from "./env";

function chave() {
  if (!env.cpfKey) throw new Error("Configure CPF_ENCRYPTION_KEY");
  return createHash("sha256").update(env.cpfKey).digest();
}

/** AES-256-GCM: iv.tag.dados (base64url) */
export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64url")).join(".");
}

export function decifrar(payload: string) {
  const [iv, tag, dados] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}

export function hmac(texto: string) {
  return createHmac("sha256", chave()).update(texto).digest("hex");
}

export function sha256(texto: string) {
  return createHash("sha256").update(texto).digest("hex");
}

export function tokenAleatorio(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
