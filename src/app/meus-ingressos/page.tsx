import { Cabecalho } from "@/components/Cabecalho";
import { PedirLink } from "./PedirLink";

export const metadata = { title: "Meus ingressos" };

export default function MeusIngressos() {
  return (
    <>
      <Cabecalho />
      <main className="relative z-10 mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-[0.65rem] uppercase tracking-[0.45em] text-ouro">Área do cliente</p>
        <h1 className="mt-3 font-display text-5xl">Meus ingressos</h1>
        <p className="mt-3 text-sm text-fumaca">Sem senha: digite o e-mail usado na compra e enviamos um link de acesso válido por 30 minutos.</p>
        <PedirLink />
      </main>
    </>
  );
}
