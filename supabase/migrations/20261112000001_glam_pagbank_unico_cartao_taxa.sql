-- Pix só pelo PagBank; SyncPay removida. Cartão com liga/desliga e taxa configurável.

-- 1) Taxa do cartão cobrada do cliente neste pedido (centavos). Fica separada do total do ingresso:
--    o faturamento da casa continua sendo o valor dos ingressos; a taxa cobre o custo do cartão.
alter table public.glam_pedidos add column if not exists taxa_cartao_centavos integer not null default 0 check (taxa_cartao_centavos >= 0);

-- 2) Configuração de pagamentos: só o que o painel controla agora.
--    (cartao_ativo mantém o comportamento de hoje: ligado; taxa começa em zero.)
insert into public.glam_config (chave, valor, atualizado_em)
values ('pagamentos', jsonb_build_object('cartao_ativo', true, 'cartao_taxa_pct', 0, 'cartao_taxa_fixa_centavos', 0), now())
on conflict (chave) do update
  set valor = jsonb_build_object(
        'cartao_ativo', coalesce((public.glam_config.valor ->> 'cartao_ativo')::boolean, true),
        'cartao_taxa_pct', coalesce((public.glam_config.valor ->> 'cartao_taxa_pct')::numeric, 0),
        'cartao_taxa_fixa_centavos', coalesce((public.glam_config.valor ->> 'cartao_taxa_fixa_centavos')::integer, 0)
      ),
      atualizado_em = now();

-- 3) Remove a SyncPay: credenciais cifradas e avisos já recebidos.
--    Os pedidos antigos mantêm gateway = 'syncpay' só como histórico (a constraint continua aceitando).
delete from public.glam_segredos where chave = 'syncpay';
delete from public.glam_webhook_eventos where provedor = 'syncpay';
