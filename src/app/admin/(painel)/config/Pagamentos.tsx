import { pagamentos } from "@/lib/gateways";
import { Selo } from "@/components/admin/Titulo";
import { FormAcao, Enviar, Confirmar } from "@/components/admin/ui";
import { desconectarGateway, salvarPagbank } from "../../pagamentos-acoes";

/** Configurações › Pagamentos: SyncPay (Pix) e PagBank (Pix e cartão). */
export async function Pagamentos() {
  const pg = await pagamentos();
  const nome = { syncpay: "SyncPay", pagbank: "PagBank", demo: "nenhum (modo demonstração)" }[pg.pix];
  return (
    <section className="mb-6 max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold">Pagamentos</h2>
      <p className="mb-4 text-sm text-fumaca">Conecte a conta PagBank da casa para receber Pix e cartão direto nela.</p>
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
          <p className="text-xs text-fumaca">Gere o token na conta PagBank que vai receber o dinheiro (PagBank › Integrações › Token).</p>
          <Enviar>{pg.pagbank ? "Trocar conta PagBank" : "Conectar PagBank"}</Enviar>
        </FormAcao>
        {pg.pagbank && !pg.pagbankPeloServidor && (
          <form action={desconectarGateway} className="mt-3">
            <input type="hidden" name="gateway" value="pagbank" />
            <Confirmar mensagem="Desconectar o PagBank?" className="text-xs text-fumaca underline hover:text-perigo">Desconectar</Confirmar>
          </form>
        )}
      </div>
    </section>
  );
}
