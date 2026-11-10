-- Gateways de pagamento configuráveis pelo painel (SyncPay para Pix, PagBank para Pix e cartão).

-- 1) Em qual gateway cada cobrança foi criada e o identificador dela lá
alter table public.glam_pedidos add column if not exists gateway text check (gateway is null or gateway in ('pagbank','syncpay','demo'));
alter table public.glam_pedidos add column if not exists gateway_tx_id text;
create index if not exists glam_pedidos_gateway_tx_idx on public.glam_pedidos (gateway_tx_id) where gateway_tx_id is not null;

-- 2) Credenciais dos gateways: sempre cifradas pela aplicação (AES-256-GCM, chave fora do banco).
--    Sem trilha automática de linha, para o valor cifrado não ser copiado para a auditoria;
--    a aplicação registra "gateway_alterado" sem nenhum valor.
create table if not exists public.glam_segredos (
  chave text primary key,
  valor_cifrado text not null,
  final text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.glam_staff(id)
);
alter table public.glam_segredos enable row level security;
revoke all on public.glam_segredos from anon, authenticated;
