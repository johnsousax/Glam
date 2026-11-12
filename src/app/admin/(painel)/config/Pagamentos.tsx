import { calcularTaxaCartao, pagamentos } from "@/lib/gateways";
import { brl } from "@/lib/format";
import { Selo } from "@/components/admin/Titulo";
import { FormAcao, Enviar, Confirmar } from "@/components/admin/ui";
import { desconectarGateway, escolherPix, salvarCartao, salvarPagbank, salvarSyncpay } from "../../pagamentos-acoes";

const virgula = (n: number) => String(n).replace(".", ",");

/** Configurações › Pagamentos: gateway do Pix (SyncPay ou PagBank), PagBank para cartão e a taxa do cartão. */
export async function Pagamentos() {
  const pg = await pagamentos();
  const t = pg.taxaCartao;
  const exemplo = 10000; // ingresso de R$ 100,00
  const taxaExemplo = calcularTaxaCartao(exemplo, t);
  return (
    <section className="mb-6 max-w-2xl space-y-4">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Pagamentos</h2>
        <p className="text-sm text-fumaca">Escolha por onde o Pix é recebido. O cartão é sempre pelo PagBank.</p>
      </div>

      <div className="cartao p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Gateway do Pix</h3>
          <Selo cor={pg.demo ? "ouro" : "sucesso"}>{pg.pix === "syncpay" ? "Pix pela SyncPay" : pg.pix === "pagbank" ? "Pix pelo PagBank" : "nenhum conectado"}</Selo>
        </div>
        <FormAcao acao={escolherPix} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {(["syncpay", "pagbank"] as const).map((g) => (
              <label key={g} className="flex cursor-pointer items-center gap-3 rounded-lg border border-linha px-3 py-3 text-sm">
                <input type="radio" name="pix_gateway" value={g} defaultChecked={pg.preferido === g} className="accent-[var(--color-ouro)]" />
                <span>{g === "syncpay" ? "SyncPay" : "PagBank"} <span className="text-xs text-fumaca">{pg[g] ? "· conectado" : "· não conectado"}</span></span>
              </label>
            ))}
          </div>
          {pg.preferido !== pg.pix && !pg.demo && <p className="text-xs text-ouro">O escolhido não está conectado; o Pix está saindo pelo {pg.pix === "syncpay" ? "SyncPay" : "PagBank"}.</p>}
          <Enviar>Usar este gateway</Enviar>
        </FormAcao>
      </div>

      <div className="cartao p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">SyncPay <span className="font-normal text-fumaca">· Pix</span></h3>
          {pg.syncpay ? <Selo cor="sucesso">conectada{pg.finalSyncpay ? ` ···${pg.finalSyncpay}` : ""}</Selo> : <Selo cor="ouro">não conectada</Selo>}
        </div>
        <FormAcao acao={salvarSyncpay} className="space-y-3" limparAoSalvar>
          <div><label className="rotulo">Client ID</label><input name="client_id" className="campo font-mono" autoComplete="off" required placeholder={pg.syncpay ? "Cole para trocar" : ""} /></div>
          <div><label className="rotulo">Client Secret</label><input name="client_secret" type="password" className="campo font-mono" autoComplete="new-password" required /></div>
          <p className="text-xs text-fumaca">Na SyncPay: Configurações › Chaves de API. As chaves são testadas antes de salvar e ficam criptografadas.</p>
          <Enviar>{pg.syncpay ? "Trocar chaves da SyncPay" : "Conectar SyncPay"}</Enviar>
        </FormAcao>
        {pg.syncpay && (
          <form action={desconectarGateway} className="mt-3">
            <input type="hidden" name="gateway" value="syncpay" />
            <Confirmar mensagem="Desconectar a SyncPay?" className="text-xs text-fumaca underline hover:text-perigo">Desconectar</Confirmar>
          </form>
        )}
      </div>

      <div className="cartao p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">PagBank <span className="font-normal text-fumaca">· Pix e cartão</span></h3>
          {pg.pagbank ? <Selo cor="sucesso">{pg.pagbank.ambiente === "production" ? "conectado" : "conectado (teste)"}{pg.finalPagbank ? ` ···${pg.finalPagbank}` : ""}</Selo> : <Selo cor="ouro">não conectado</Selo>}
        </div>
        <FormAcao acao={salvarPagbank} className="space-y-3" limparAoSalvar>
          <div><label className="rotulo">Token do PagBank</label><input name="token" type="password" className="campo font-mono" autoComplete="new-password" required placeholder={pg.pagbank ? "Cole para trocar" : ""} /></div>
          <div><label className="rotulo">Ambiente</label>
            <select name="ambiente" className="campo" defaultValue={pg.pagbank?.ambiente || "production"}>
              <option value="production">Produção (cobra de verdade)</option>
              <option value="sandbox">Teste (sandbox)</option>
            </select>
          </div>
          <p className="text-xs text-fumaca">Gere o token na conta PagBank que vai receber o dinheiro (PagBank › Integrações › Token).</p>
          <Enviar>{pg.pagbank ? "Trocar conta PagBank" : "Conectar PagBank"}</Enviar>
        </FormAcao>
        {pg.pagbank && !pg.pagbankPeloServidor && (
          <form action={desconectarGateway} className="mt-3">
            <input type="hidden" name="gateway" value="pagbank" />
            <Confirmar mensagem="Desconectar o PagBank? O site para de cobrar até conectar de novo." className="text-xs text-fumaca underline hover:text-perigo">Desconectar</Confirmar>
          </form>
        )}
      </div>

      <div className="cartao p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Cartão de crédito <span className="font-normal text-fumaca">· à vista</span></h3>
          {pg.cartao ? <Selo cor="sucesso">ligado</Selo> : pg.cartaoLigado ? <Selo cor="ouro">ligado, falta conectar o PagBank</Selo> : <Selo cor="ouro">desligado</Selo>}
        </div>
        <FormAcao acao={salvarCartao} className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" name="cartao_ativo" defaultChecked={pg.cartaoLigado} className="h-4 w-4 accent-[var(--color-ouro)]" />
            Aceitar cartão de crédito no site
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo">Taxa do cartão (%)</label>
              <input name="taxa_pct" inputMode="decimal" className="campo" defaultValue={t.pct ? virgula(t.pct) : ""} placeholder="0" />
              <p className="mt-1 text-xs text-fumaca">Somada sobre o valor dos ingressos. Ex.: 4,99</p>
            </div>
            <div>
              <label className="rotulo">Valor fixo por compra (R$)</label>
              <input name="taxa_fixa" inputMode="decimal" className="campo" defaultValue={t.fixaCentavos ? virgula(t.fixaCentavos / 100) : ""} placeholder="0,00" />
              <p className="mt-1 text-xs text-fumaca">Opcional. Ex.: 0,50</p>
            </div>
          </div>
          <p className="rounded-lg border border-linha px-3 py-2 text-xs text-fumaca">
            Hoje, num ingresso de {brl(exemplo)}: <b className="text-marfim">{taxaExemplo ? `o cliente paga ${brl(exemplo + taxaExemplo)} no cartão (taxa de ${brl(taxaExemplo)})` : `o cliente paga ${brl(exemplo)} no cartão (sem taxa)`}</b> e {brl(exemplo)} no Pix.
            O cliente vê a taxa antes de pagar. A taxa não entra no faturamento dos relatórios.
          </p>
          <Enviar>Salvar cartão</Enviar>
        </FormAcao>
      </div>
    </section>
  );
}
