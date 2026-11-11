import { Cabecalho } from "@/components/Cabecalho";
import { lerTokenDescadastro } from "@/lib/descadastro";
import { db } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sair da lista · GLAM House", robots: { index: false } };

/** "Não quero mais receber": tira o cliente da lista de novidades. */
export default async function Descadastrar({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const id = lerTokenDescadastro(t);
  if (id) await db().from("glam_clientes").update({ aceita_marketing: false, descadastro_em: new Date().toISOString() }).eq("id", id);
  return (
    <>
      <Cabecalho />
      <main className="relative z-10 mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-display text-3xl">{id ? "Pronto, você saiu da lista" : "Link inválido"}</h1>
        <p className="mt-3 text-sm text-fumaca">{id ? "Você não vai mais receber novidades da GLAM. Os e-mails dos seus ingressos continuam chegando normalmente." : "Este link não é válido ou já expirou."}</p>
      </main>
    </>
  );
}
