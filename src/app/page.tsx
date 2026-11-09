import { Intro } from "@/components/Intro";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { FestaCard } from "@/components/FestaCard";
import { PromoterRef } from "@/components/PromoterRef";
import { Logo } from "@/components/Logo";
import { festasPublicadas } from "@/lib/festas";
import { configCasa } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [festas, casa] = await Promise.all([festasPublicadas().catch(() => []), configCasa()]);

  return (
    <>
      <Intro />
      <PromoterRef />
      <Cabecalho />
      <main className="relative z-10">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(50% 60% at 50% 0%, rgb(212 175 106 / .16), transparent 70%)" }} />
          <svg className="pointer-events-none absolute -right-24 top-10 h-[520px] w-[520px] opacity-[0.05]" viewBox="0 0 100 100" aria-hidden>
            <path d="M50 2 L98 98 L80 98 L50 36 L20 98 L2 98 Z M50 50 L68 98 L32 98 Z" fill="#d4af6a" />
          </svg>
          <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-16 pt-20 text-center sm:pt-28">
            <p className="surge text-[0.65rem] uppercase tracking-[0.5em] text-ouro">GLAM House · São Luís / MA</p>
            <Logo className="surge mt-8 w-[min(70vw,360px)]" animado />
            <h1 className="surge mt-8 font-display text-[clamp(2rem,6vw,3.6rem)] italic leading-[1.05] text-marfim" style={{ animationDelay: ".15s" }}>
              A casinha mais <span className="texto-ouro brilho-ouro not-italic font-semibold">amada</span> de São Luís
            </h1>
            <p className="surge mt-5 max-w-xl text-sm leading-relaxed text-fumaca" style={{ animationDelay: ".3s" }}>
              Escolha a festa, pague no Pix ou cartão e receba seu ingresso com QR na hora, no e-mail e no WhatsApp.
            </p>
            <a href="#festas" className="btn-ouro ouro-gradiente surge mt-10" style={{ animationDelay: ".45s" }}>Ver festas</a>
          </div>
        </section>

        {/* Vitrine */}
        <section id="festas" className="mx-auto max-w-6xl scroll-mt-24 px-4 sm:px-6">
          <div className="mb-10 flex flex-col items-center gap-3 text-center">
            <span className="text-[0.65rem] uppercase tracking-[0.5em] text-ouro">Agenda</span>
            <h2 className="font-display text-4xl text-marfim sm:text-5xl">Próximas festas</h2>
            <div className="linha-ouro w-40" />
          </div>
          {festas.length === 0 ? (
            <div className="cartao mx-auto max-w-lg p-10 text-center">
              <p className="font-display text-2xl italic text-marfim">Em breve, novas noites inesquecíveis.</p>
              <p className="mt-3 text-sm text-fumaca">Acompanhe a GLAM no Instagram para saber primeiro.</p>
              {casa.whatsapp_casa && (
                <a className="btn-linha mt-6" href={`https://wa.me/${casa.whatsapp_casa}?text=${encodeURIComponent("Olá! Quero saber das próximas festas da GLAM ✨")}`} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {festas.map((f, i) => (
                <FestaCard key={f.id} festa={f} aPartir={f.a_partir} esgotada={f.esgotada} percentual={f.percentual} indice={i} />
              ))}
            </div>
          )}
        </section>

        {/* Como funciona */}
        <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["01", "Escolha", "Festa, setor e quantidade, com o nome de cada pessoa."],
              ["02", "Pague", "Pix ou cartão. Sua vaga fica reservada por 15 minutos."],
              ["03", "Receba", "Ingresso com QR no e-mail e no WhatsApp, na hora."],
              ["04", "Entre", "Mostre o QR na portaria. Cada ingresso entra uma vez só."],
            ].map(([n, t, d]) => (
              <div key={n} className="cartao p-6">
                <span className="texto-ouro font-display text-4xl">{n}</span>
                <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-marfim">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fumaca">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Rodape whatsapp={casa.whatsapp_casa} instagram={casa.instagram} />
    </>
  );
}
