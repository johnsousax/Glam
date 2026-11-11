import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const OCIOSO_MS = 30 * 60 * 1000; // painel: 30 min parado = sai
const AREA_EQUIPE = /^\/(admin|portaria)(\/|$)/;

const opcoesCookieSessao = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };

function csp(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: ${dev ? "'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://www.facebook.com https://*.pagseguro.com.br https://*.pagbank.com.br",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://www.facebook.com https://connect.facebook.net https://*.pagseguro.com.br https://*.pagbank.com.br https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const politica = csp(nonce);
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("Content-Security-Policy", politica);

  let resposta = NextResponse.next({ request: { headers: reqHeaders } });

  if (AREA_EQUIPE.test(request.nextUrl.pathname)) {
    const temSessao = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    const ultima = Number(request.cookies.get("glam_atv")?.value || 0);
    const naLogin = request.nextUrl.pathname.startsWith("/admin/login") || request.nextUrl.pathname.startsWith("/admin/setup");

    // Sessão ociosa demais: derruba e manda para o login
    if (temSessao && ultima && Date.now() - ultima > OCIOSO_MS && !naLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "?expirou=1";
      const r = NextResponse.redirect(url);
      request.cookies.getAll().filter((c) => c.name.startsWith("sb-") || c.name === "glam_atv").forEach((c) => r.cookies.delete(c.name));
      r.headers.set("Content-Security-Policy", politica);
      return r;
    }

    // Renova o token do Supabase (cookies httpOnly, nunca acessíveis ao JavaScript)
    if (temSessao && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookieOptions: opcoesCookieSessao,
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (lista) => {
            lista.forEach(({ name, value }) => request.cookies.set(name, value));
            resposta = NextResponse.next({ request: { headers: reqHeaders } });
            lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, { ...options, ...opcoesCookieSessao }));
          },
        },
      });
      await sb.auth.getClaims(); // renova a sessão se precisar; assinatura conferida localmente (ES256)
      resposta.cookies.set("glam_atv", String(Date.now()), { ...opcoesCookieSessao, maxAge: 60 * 60 * 12 });
    }
    resposta.headers.set("Cache-Control", "no-store");
  }

  resposta.headers.set("Content-Security-Policy", politica);
  return resposta;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo-|baile-whatsapp).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
