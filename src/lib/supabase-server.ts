import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "./env";

/** Cookies da sessão da equipe: httpOnly (JS não lê), Secure e SameSite=Strict. */
export const opcoesCookieSessao = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };

/** Cliente de autenticação da equipe. Todo login/MFA acontece no servidor. */
export async function authClient() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookieOptions: opcoesCookieSessao,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, { ...options, ...opcoesCookieSessao }));
        } catch {
          // chamado de um Server Component: o proxy renova a sessão
        }
      },
    },
  });
}
