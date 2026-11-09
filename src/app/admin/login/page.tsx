import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { staffAtual } from "@/lib/staff";
import { db } from "@/lib/supabase-admin";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar no painel", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ etapa?: string; expirou?: string }> }) {
  const { etapa, expirou } = await searchParams;
  const { staff, precisaMfa } = await staffAtual();
  if (staff && !precisaMfa) redirect(staff.papel === "portaria" ? "/portaria" : "/admin");
  const { count } = await db().from("glam_staff").select("*", { count: "exact", head: true });
  if (!count) redirect("/admin/setup");
  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(40% 40% at 50% 30%, rgb(212 175 106 / .12), transparent 70%)" }} />
      <div className="relative w-full max-w-sm">
        <Logo className="mx-auto w-40" dourado />
        <p className="mt-4 text-center text-[0.65rem] uppercase tracking-[0.45em] text-fumaca">Painel da casa</p>
        {expirou && <p className="mt-6 text-center text-sm text-fumaca">Sessão encerrada por inatividade. Entre de novo.</p>}
        <LoginForm mfaInicial={etapa === "mfa" || precisaMfa} />
      </div>
    </main>
  );
}
