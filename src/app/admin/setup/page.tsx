import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { db } from "@/lib/supabase-admin";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Primeiro acesso", robots: { index: false } };

/** Cria a conta do DONO. Só funciona enquanto não houver ninguém na equipe. */
export default async function Setup() {
  const { count } = await db().from("glam_staff").select("*", { count: "exact", head: true });
  if (count) redirect("/admin/login");
  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto w-40" animado />
        <h1 className="mt-6 text-center font-display text-3xl">Primeiro acesso</h1>
        <p className="mt-2 text-center text-sm text-fumaca">Crie a conta do dono da casa. Depois, adicione a equipe pelo painel.</p>
        <SetupForm />
      </div>
    </main>
  );
}
