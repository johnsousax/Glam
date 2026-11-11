import { PaginaTexto } from "@/components/PaginaTexto";
import { configCasa } from "@/lib/config";

export const metadata = { title: "Política de privacidade" };

export default async function Privacidade() {
  const casa = await configCasa();
  const contato = casa.email_dono || "o e-mail de atendimento da casa";
  return (
    <PaginaTexto titulo="Política de privacidade" versao="1.0 · novembro de 2026">
      <p>Esta política explica como a {casa.nome} ({casa.cidade}) trata seus dados pessoais na compra de ingressos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      <h2>Quais dados coletamos e por quê</h2>
      <ul>
        <li><b>Nome, e-mail e WhatsApp:</b> emitir e enviar seu ingresso, avisar sobre o pedido e a festa (execução de contrato).</li>
        <li><b>CPF:</b> exigido pelo PagBank para processar o pagamento e para evitar fraude. Fica criptografado no nosso banco (AES-256) e nunca aparece no painel.</li>
        <li><b>Nomes dos acompanhantes:</b> identificar cada ingresso na portaria.</li>
        <li><b>Dados do cartão:</b> não passam pelos nossos servidores — são criptografados no seu aparelho e enviados direto ao PagBank.</li>
        <li><b>Registros de acesso (IP, data e hora):</b> segurança e cumprimento do Marco Civil da Internet (guarda mínima de 6 meses).</li>
        <li><b>Novidades da GLAM:</b> como cliente, você pode receber por e-mail avisos de próximas festas e promoções (legítimo interesse). Todo e-mail tem o link “não quero mais receber”, que tira você da lista na hora.</li>
        <li><b>Cookies de marketing (Meta):</b> só com o seu consentimento no aviso de cookies. Você pode recusar.</li>
      </ul>
      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>PagBank (pagamentos), Supabase (banco de dados), Vercel (hospedagem), Resend (e-mails), provedor de WhatsApp e Meta (somente se você aceitar cookies de marketing).</li>
        <li>Não vendemos seus dados.</li>
      </ul>
      <h2>Por quanto tempo</h2>
      <p>Pedidos e pagamentos são guardados pelo prazo exigido pela legislação fiscal. Dados de contato podem ser excluídos a qualquer momento a seu pedido, mantendo apenas o necessário para obrigações legais.</p>
      <h2>Seus direitos</h2>
      <p>Você pode acessar, exportar e excluir seus dados em <a className="underline" href="/meus-ingressos">Meus ingressos</a> (entre com seu e-mail e use “Meus dados”), ou falar com o responsável pelos dados em <b>{contato}</b>.</p>
      <h2>Segurança</h2>
      <p>Conexão criptografada (HTTPS), CPF criptografado, QR Codes aleatórios impossíveis de adivinhar, acesso da equipe com senha e verificação em 2 etapas, e registro de todas as ações sensíveis.</p>
    </PaginaTexto>
  );
}
