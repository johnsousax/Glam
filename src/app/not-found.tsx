import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NaoEncontrado() {
  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo className="w-32" />
      <h1 className="mt-8 font-display text-5xl">Página não encontrada</h1>
      <p className="mt-3 text-sm text-fumaca">Essa festa pode ter acabado — mas a próxima já vem aí.</p>
      <Link href="/" className="btn-ouro ouro-gradiente mt-8">Ver festas</Link>
    </main>
  );
}
