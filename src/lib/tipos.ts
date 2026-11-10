export type Festa = {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  descricao: string | null;
  cartaz_url: string | null;
  data_inicio: string;
  data_fim: string | null;
  local_nome: string | null;
  endereco: string | null;
  lotacao: number;
  mostrar_percentual: boolean;
  classificacao: string | null;
  status: "rascunho" | "publicada" | "inativa" | "esgotada" | "encerrada" | "cancelada";
};

export type Lote = {
  id: string;
  festa_id: string;
  setor: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  capacidade: number;
  pessoas_por_unidade: number;
  max_por_pedido: number;
  ordem: number;
  inicio_vendas: string | null;
  fim_vendas: string | null;
  ativo: boolean;
};

export type LoteVitrine = Lote & {
  ocupado: number;
  disponivel: number;
  situacao: "a_venda" | "esgotado" | "em_breve" | "encerrado";
};

export type SetorVitrine = {
  setor: string;
  atual: LoteVitrine | null;   // lote que está à venda agora (virada automática)
  proximo: LoteVitrine | null;
  lotes: LoteVitrine[];
};
