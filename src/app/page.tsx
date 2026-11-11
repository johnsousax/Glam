import { Intro } from "@/components/Intro";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { FestaCard } from "@/components/FestaCard";
import { PromoterRef } from "@/components/PromoterRef";
import { festasPublicadas } from "@/lib/festas";
import { configCasa } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ abertura?: string }> }) {
  const [festas, casa, sp] = await Promise.all([festasPublicadas().catch(() => []), configCasa(), searchParams]);

  return (
    <>
      <Intro key={sp.abertura ? "forcar" : "normal"} forcar={!!sp.abertura} />
      <PromoterRef />
      <Cabecalho />
      <main className="relative z-10 mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="mb-10 text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.45em] text-ouro">Ingressos</p>
          <h1 className="mt-2 font-display text-4xl text-marfim sm:text-5xl">Próximas festas</h1>
          <div className="linha-dourada mx-auto mt-4 w-32" />
        </div>

        {festas.length === 0 ? (
          <div className="cartao mx-auto max-w-lg p-10 text-center">
            <p className="font-display text-2xl italic text-marfim">Em breve, novas noites inesquecíveis.</p>
            <p className="mt-3 text-sm text-fumaca">Nenhuma festa à venda no momento.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {festas.map((f, i) => (
              <FestaCard key={f.id} festa={f} aPartir={f.a_partir} esgotada={f.esgotada} percentual={f.percentual} indice={i} />
            ))}
          </div>
        )}
      </main>
      <Rodape whatsapp={casa.whatsapp_casa} instagram={casa.instagram} />
    </>
  );
}
