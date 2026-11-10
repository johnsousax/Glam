import { pagamentos } from "@/lib/gateways";
import { Selo } from "@/components/admin/Titulo";
import { FormAcao, Enviar, Confirmar } from "@/components/admin/ui";
import { desconectarGateway, escolherPix, salvarPagbank, salvarResend, salvarSyncpay } from "../../pagamentos-acoes";
import { db } from "@/lib/supabase-admin";

/** Configurações › Pagamentos: SyncPay (Pix) e PagBank (Pix e cartão). */
export async function Pagamentos() {
  const pg = await pagamentos();
  const { data: resend } = await db().from("glam_segredos").select("final").eq("chave", "resend").maybeSingle();
  const nome = { syncpay: "SyncPay", pagbank: "PagBank", demo: "nenhum (modo demonstração)" }[pg.pix];
  return (
    <section className="mb-6 max-w-4xl">
      <h2 className="mb-1 text-lg font-semibold">Pagamentos e e-mail</h2>
      <p className="mb-4 text-sm text-fumaca">
        Pix recebido por: <b className="text-marfim">{nome}</b> · Cartão: <b className="text-marfim">{pg.cartao ? "PagBank" : "desligado"}</b>
        {pg.demo && " · conecte uma conta abaixo para começar a cobrar de verdade."}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="cartao p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">SyncPay <span className="font-normal text-fumaca">· Pix</span></h3>
            {pg.syncpay ? <Selo cor="sucesso">conectada{pg.finais.syncpay ? ` ···${pg.finais.syncpay}` : ""}</Selo> : <Selo cor="ouro">não conectada</Selo>}
          </div>
          <FormAcao acao={salvarSyncpay} className="space-y-3" limparAoSalvar>
            <div><label className="rotulo">Client ID</label><input name="client_id" className="campo font-mono" autoComplete="off" required placeholder={pg.syncpay ? "Cole para trocar" : ""} /></div>
            <div><label className="rotulo">Client Secret</label><input name="client_secret" type="password" className="campo font-mono" autoComplete="new-password" required placeholder={pg.syncpay ? "Cole para trocar" : ""} /></div>
            <p className="text-xs text-fumaca">Pegue os dois no painel da SyncPay, em Chaves de API. Eles são testados na hora e guardados criptografados; depois de salvos, não aparecem mais aqui.</p>
            <Enviar>{pg.syncpay ? "Trocar conta SyncPay" : "Conectar SyncPay"}</Enviar>
          </FormAcao>
          {pg.syncpay && (
            <form action={desconectarGateway} className="mt-3">
              <input type="hidden" name="gateway" value="syncpay" />
              <Confirmar mensagem="Desconectar a SyncPay? O Pix deixa de sair por ela." className="text-xs text-fumaca underline hover:text-perigo">Desconectar</Confirmar>
            </form>
          )}
        </div>

        <div className="cartao p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">PagBank <span className="font-normal text-fumaca">· Pix e cartão</span></h3>
            {pg.pagbank ? <Selo cor="sucesso">{pg.pagbank.ambiente === "production" ? "conectado" : "conectado (teste)"}{pg.finais.pagbank ? ` ···${pg.finais.pagbank}` : ""}</Selo> : <Selo cor="ouro">não conectado</Selo>}
          </div>
          <FormAcao acao={salvarPagbank} className="space-y-3" limparAoSalvar>
            <div><label className="rotulo">Token do PagBank</label><input name="token" type="password" className="campo font-mono" autoComplete="new-password" required placeholder={pg.pagbank ? "Cole para trocar" : ""} /></div>
            <div><label className="rotulo">Ambiente</label>
              <select name="ambiente" className="campo" defaultValue={pg.pagbank?.ambiente || "production"}>
                <option value="production">Produção (cobra de verdade)</option>
                <option value="sandbox">Teste (sandbox)</option>
              </select>
            </div>
            <p className="text-xs text-fumaca">Gere o token na conta PagBank que vai receber o dinheiro. Com ele conectado, o cartão aparece no site.</p>
            <Enviar>{pg.pagbank ? "Trocar conta PagBank" : "Conectar PagBank"}</Enviar>
          </FormAcao>
          {pg.pagbank && !pg.pagbankPeloServidor && (
            <form action={desconectarGateway} className="mt-3">
              <input type="hidden" name="gateway" value="pagbank" />
              <Confirmar mensagem="Desconectar o PagBank? O cartão some do site." className="text-xs text-fumaca underline hover:text-perigo">Desconectar</Confirmar>
            </form>
          )}
        </div>
      </div>

      <div className="cartao mt-4 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">E-mail <span className="font-normal text-fumaca">· Resend (ingressos em PDF)</span></h3>
          {resend ? <Selo cor="sucesso">ligado{resend.final ? ` ···${resend.final}` : ""}</Selo> : process.env.RESEND_API_KEY ? <Selo cor="sucesso">ligado pelo servidor</Selo> : <Selo cor="perigo">desligado</Selo>}
        </div>
        <FormAcao acao={salvarResend} className="space-y-3" limparAoSalvar>
          <div><label className="rotulo">Chave de API do Resend</label><input name="chave" type="password" className="campo font-mono" autoComplete="new-password" required placeholder={resend ? "Cole para trocar" : "re_..."} /></div>
          <p className="text-xs text-fumaca">No Resend: API Keys › Create API Key › permissão “Sending access”, domínio glamhouse.site. Ao salvar, mando um e-mail de teste para você.</p>
          <Enviar>{resend ? "Trocar chave" : "Ligar e-mails"}</Enviar>
        </FormAcao>
        {resend && (
          <form action={desconectarGateway} className="mt-3">
            <input type="hidden" name="gateway" value="resend" />
            <Confirmar mensagem="Desligar os e-mails? Os ingressos deixam de ir por e-mail." className="text-xs text-fumaca underline hover:text-perigo">Desligar</Confirmar>
          </form>
        )}
      </div>

      {pg.syncpay && pg.pagbank && (
        <FormAcao acao={escolherPix} className="cartao mt-4 flex flex-wrap items-end gap-3 p-5">
          <div className="min-w-56 flex-1"><label className="rotulo">Receber o Pix por</label>
            <select name="pix_gateway" className="campo" defaultValue={pg.preferido}>
              <option value="syncpay">SyncPay</option>
              <option value="pagbank">PagBank</option>
            </select>
          </div>
          <Enviar>Salvar</Enviar>
        </FormAcao>
      )}
    </section>
  );
}
