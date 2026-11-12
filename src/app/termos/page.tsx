import { PaginaTexto } from "@/components/PaginaTexto";
import { configCasa } from "@/lib/config";

export const metadata = { title: "Termos de compra" };

export default async function Termos() {
  const casa = await configCasa();
  return (
    <PaginaTexto titulo="Termos de compra" versao="1.0 · novembro de 2026">
      <h2>Ingresso</h2>
      <ul>
        <li>Cada ingresso tem um QR Code único que dá direito a <b>uma entrada</b>. Depois de lido na portaria, não entra de novo.</li>
        <li>Não compartilhe print do QR: quem apresentar primeiro entra.</li>
        <li>Você pode transferir o ingresso para outra pessoa pela página do ingresso (gera um QR novo e o anterior deixa de valer).</li>
        <li>Pode ser pedido documento com foto na entrada. Respeite a classificação etária de cada festa.</li>
      </ul>
      <h2>Pagamento e reserva</h2>
      <ul>
        <li>Pagamento por Pix ou cartão de crédito à vista, processado pelo PagBank.</li>
        <li>Se a casa cobrar uma taxa no cartão, o valor da taxa e o total aparecem antes de você pagar. No Pix não há taxa.</li>
        <li>O ingresso fica reservado por 15 minutos enquanto o pagamento não é confirmado. Depois disso, volta para a venda.</li>
        <li>O ingresso só é emitido depois que o PagBank confirma o pagamento.</li>
      </ul>
      <h2>Cancelamento e reembolso</h2>
      <ul>
        <li>Em compras pela internet, você pode desistir em até 7 dias da compra (art. 49 do Código de Defesa do Consumidor), desde que antes da data da festa.</li>
        <li>Se a festa for cancelada pela casa, o valor é devolvido integralmente pela mesma forma de pagamento.</li>
        <li>Para pedir, fale com a {casa.nome} informando o código do pedido (GLM-XXXXXX).</li>
      </ul>
      <h2>Lotes, cupons e promoters</h2>
      <p>Preços mudam por lote (por data ou esgotamento). Cupons têm regras e limites próprios e são conferidos no fechamento da compra.</p>
    </PaginaTexto>
  );
}
