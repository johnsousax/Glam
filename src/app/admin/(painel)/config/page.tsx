import { exigirStaff } from "@/lib/staff";
import { configCasa } from "@/lib/config";
import { env } from "@/lib/env";
import { pagamentos } from "@/lib/gateways";
import { Pagamentos } from "./Pagamentos";
import { Selo, Titulo } from "@/components/admin/Titulo";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { salvarConfig } from "../../acoes";
import { WhatsappConexao } from "./WhatsappConexao";

export const dynamic = "force-dynamic";

export default async function Config() {
  await exigirStaff("config");
  const c = await configCasa();
  const pg = await pagamentos();
  const campo = (nome: keyof typeof c, rotulo: string, dica?: string) => (
    <div><label className="rotulo">{rotulo}</label><input name={nome} className="campo" defaultValue={String(c[nome] ?? "")} />{dica && <p className="mt-1 text-xs text-fumaca">{dica}</p>}</div>
  );
  return (
    <>
      <Titulo sup="Casa" titulo="Configurações" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="cartao p-4"><p className="rotulo">Pagamentos</p>{pg.demo ? <Selo cor="ouro">aguardando conexão</Selo> : <Selo cor="sucesso">recebendo</Selo>}</div>
        <div className="cartao p-4"><p className="rotulo">Endereço do site</p><p className="truncate text-sm">{env.siteUrl}</p></div>
      </div>
      <Pagamentos />
      <WhatsappConexao numeroCasa={String(c.whatsapp_casa || "")} />
      <FormAcao acao={salvarConfig} className="cartao grid max-w-4xl gap-4 p-6 sm:grid-cols-2">
        {campo("nome", "Nome da casa")}
        {campo("slogan", "Slogan")}
        {campo("cidade", "Cidade")}
        {campo("endereco", "Endereço (vai no e-mail “É hoje”)")}
        {campo("instagram", "Instagram")}
        {campo("whatsapp_casa", "WhatsApp da casa", "Botão “Avisar a GLAM” após a compra. Ex.: 5598985840529")}
        {campo("whatsapp_dono", "WhatsApp do dono", "Recebe: lote esgotado, relatório do dia seguinte e alerta de site fora do ar.")}
        {campo("email_dono", "E-mail do dono", "Recebe o relatório e a cópia de segurança diária.")}
        <input type="hidden" name="email_remetente" value={c.email_remetente || ""} />
        <input type="hidden" name="evolution_instancia" value={c.evolution_instancia || "glam"} />
        <div><label className="rotulo">Comissão padrão dos promoters (%)</label><input name="comissao_padrao" className="campo" defaultValue={c.comissao_padrao} /></div>
        <div className="sm:col-span-2"><Enviar>Salvar configurações</Enviar></div>
      </FormAcao>
    </>
  );
}
