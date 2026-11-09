// Leitura centralizada das variáveis de ambiente (somente servidor).
export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  pagbankToken: process.env.PAGBANK_TOKEN || "",
  pagbankEnv: (process.env.PAGBANK_ENV || "sandbox") as "sandbox" | "production",
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || "",
  automacaoSecret: process.env.GLAM_AUTOMACAO_SECRET || "",
  cpfKey: process.env.CPF_ENCRYPTION_KEY || "",
};

/** Sem token do PagBank o sistema roda em "modo demonstração" (pagamento simulado). */
export const modoDemo = () => !env.pagbankToken;
