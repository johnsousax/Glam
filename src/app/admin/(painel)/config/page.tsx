import { exigirStaff } from "@/lib/staff";
import { configCasa } from "@/lib/config";
import { env, modoDemo } from "@/lib/env";
import { Selo, Titulo } from "@/components/admin/Titulo";
import { FormAcao, Enviar } from "@/components/admin/ui";
import { salvarConfig } from "../../acoes";
import { WhatsappConexao } from "./WhatsappConexao";

export const dynamic = "force-dynamic";

export default async function Config() {
  await exigirStaff("config");
  const c = await configCasa();
  const campo = (nome: keyof typeof c, rotulo: string, dica?: string) => (
    <div><label className="rotulo">{rotulo}</label><input name={nome} className="campo" defaultValue={String(c[nome] ?? "")} />{dica && <p className="mt-1 text-xs text-fumaca">{dica}</p>}</div>
  );
  return (
    <>
      <Titulo sup="Casa" titulo="Configurações" />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="cartao p-4"><p className="rotulo">PagBank</p>{modoDemo() ? <Selo cor="ouro">modo demonstração</Selo> : <Selo cor="sucesso">{env.pagbankEnv === "production" ? "produção" : "sandbox"}</Selo>}</div>
        <div className="cartao p-4"><p className="rotulo">Automações n8n</p>{env.n8nWebhookUrl ? <Selo cor="sucesso">conectado</Selo> : <Selo cor="perigo">sem webhook</Selo>}</div>
        <div className="cartao p-4"><p className="rotulo">Endereço do site</p><p className="truncate text-sm">{env.siteUrl}</p></div>
      </div>
      <WhatsappConexao />
      <FormAcao acao={salvarConfig} className="cartao grid max-w-4xl gap-4 p-6 sm:grid-cols-2">
        {campo("nome", "Nome da casa")}
        {campo("slogan", "Slogan")}
        {campo("cidade", "Cidade")}
        {campo("endereco", "Endereço (vai no e-mail “É hoje”)")}
        {campo("instagram", "Instagram")}
        {campo("whatsapp_casa", "WhatsApp da casa", "Botão “Avisar a GLAM” após a compra. Ex.: 5598985840529")}
        {campo("whatsapp_dono", "WhatsApp do dono", "Recebe: lote esgotado, relatório do dia seguinte e alerta de site fora do ar.")}
        {campo("email_dono", "E-mail do dono", "Recebe o relatório e a cópia de segurança diária.")}
        {campo("email_remetente", "Remetente dos e-mails", "Domínio verificado no Resend. Ex.: GLAM House <ingressos@glam.com.br>")}
        {campo("evolution_instancia", "Instância do WhatsApp (Evolution)", "Deixe “glam” — é a instância conectada pelo botão acima.")}
        <div><label className="rotulo">Comissão padrão dos promoters (%)</label><input name="comissao_padrao" className="campo" defaultValue={c.comissao_padrao} /></div>
        <div className="sm:col-span-2"><Enviar>Salvar configurações</Enviar></div>
      </FormAcao>
    </>
  );
}
