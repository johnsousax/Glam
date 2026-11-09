-- =====================================================================
-- GLAM · Camada de segurança (padrão "Segurança Máxima")
-- =====================================================================

-- 1) Limite de tentativas (rate limit) sem serviço externo: janela fixa por chave
create table if not exists public.glam_limites (
  chave text not null,
  janela timestamptz not null,
  total integer not null default 0,
  primary key (chave, janela)
);
alter table public.glam_limites enable row level security;

create or replace function public.glam_limite(p_chave text, p_max integer, p_janela_seg integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_janela timestamptz := to_timestamp(floor(extract(epoch from now()) / p_janela_seg) * p_janela_seg);
  v_total integer;
begin
  insert into public.glam_limites as l (chave, janela, total) values (p_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = l.total + 1
  returning total into v_total;
  return v_total <= p_max;
end $$;

-- 2) Webhooks: cada evento processado uma vez só
create table if not exists public.glam_webhook_eventos (
  provedor text not null,
  evento_id text not null,
  recebido_em timestamptz not null default now(),
  primary key (provedor, evento_id)
);
alter table public.glam_webhook_eventos enable row level security;

create or replace function public.glam_registrar_evento(p_provedor text, p_evento text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.glam_webhook_eventos (provedor, evento_id) values (p_provedor, p_evento)
  on conflict do nothing;
  return found;
end $$;

-- 3) Pedidos: idempotência, acesso do comprador e revisão de valor divergente
alter table public.glam_pedidos add column if not exists idempotency_key text;
alter table public.glam_pedidos add column if not exists acesso_hash text;
alter table public.glam_pedidos add column if not exists em_revisao boolean not null default false;
alter table public.glam_pedidos add column if not exists motivo_revisao text;
create unique index if not exists glam_pedidos_idem_idx on public.glam_pedidos (idempotency_key) where idempotency_key is not null;

-- 4) Cupom com limite de usos por cliente
alter table public.glam_cupons add column if not exists limite_por_cliente integer check (limite_por_cliente is null or limite_por_cliente > 0);

-- 7) Criação de pedido com idempotência, teto de reservas e limite de cupom por cliente
create or replace function public.glam_criar_pedido_v2(
  p_festa_id uuid,
  p_cliente_id uuid,
  p_itens jsonb,
  p_cupom text default null,
  p_promoter text default null,
  p_canal text default 'site',
  p_metodo text default null,
  p_staff_id uuid default null,
  p_ignorar_janela boolean default false,
  p_idempotencia text default null,
  p_acesso_hash text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_festa glam_festas%rowtype;
  v_item jsonb;
  v_lote glam_lotes%rowtype;
  v_qtd int;
  v_subtotal int := 0;
  v_desconto int := 0;
  v_pessoas int := 0;
  v_cupom glam_cupons%rowtype;
  v_promoter_id uuid;
  v_pedido_id uuid;
  v_codigo text;
  v_base_cupom int := 0;
  v_existente glam_pedidos%rowtype;
begin
  -- Mesma chave de idempotência = mesmo pedido (dois cliques nunca viram duas compras)
  if p_idempotencia is not null then
    select * into v_existente from glam_pedidos where idempotency_key = p_idempotencia;
    if found then
      if v_existente.cliente_id is distinct from p_cliente_id then raise exception 'IDEMPOTENCIA_INVALIDA'; end if;
      return jsonb_build_object('id', v_existente.id, 'codigo', v_existente.codigo, 'subtotal', v_existente.subtotal_centavos,
        'desconto', v_existente.desconto_centavos, 'total', v_existente.total_centavos, 'repetido', true);
    end if;
  end if;

  select * into v_festa from glam_festas where id = p_festa_id for update;
  if not found then raise exception 'FESTA_NAO_ENCONTRADA'; end if;
  if p_canal = 'site' and v_festa.status <> 'publicada' then raise exception 'FESTA_INDISPONIVEL'; end if;
  if v_festa.status in ('cancelada','encerrada') then raise exception 'FESTA_INDISPONIVEL'; end if;

  -- Antifraude: no máximo 3 reservas abertas por cliente (evita "segurar" o estoque)
  if p_canal = 'site' and (select count(*) from glam_pedidos where cliente_id = p_cliente_id
      and status = 'pendente' and expira_em > now()) >= 3 then
    raise exception 'MUITAS_RESERVAS';
  end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 10 then
    raise exception 'ITENS_INVALIDOS';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item->>'quantidade')::int;
    if v_qtd is null or v_qtd <= 0 or v_qtd > 50 then raise exception 'QUANTIDADE_INVALIDA'; end if;
    select * into v_lote from glam_lotes where id = (v_item->>'lote_id')::uuid and festa_id = p_festa_id for update;
    if not found then raise exception 'LOTE_INVALIDO'; end if;
    if not v_lote.ativo then raise exception 'LOTE_INDISPONIVEL:%', v_lote.nome; end if;
    if not p_ignorar_janela then
      if v_lote.inicio_vendas is not null and now() < v_lote.inicio_vendas then raise exception 'LOTE_NAO_INICIADO:%', v_lote.nome; end if;
      if v_lote.fim_vendas is not null and now() > v_lote.fim_vendas then raise exception 'LOTE_ENCERRADO:%', v_lote.nome; end if;
      if v_qtd > v_lote.max_por_pedido then raise exception 'LIMITE_POR_PEDIDO:%', v_lote.max_por_pedido; end if;
    end if;
    if glam_lote_ocupado(v_lote.id) + v_qtd > v_lote.capacidade then raise exception 'LOTE_ESGOTADO:%', v_lote.nome; end if;
    v_subtotal := v_subtotal + v_qtd * v_lote.preco_centavos;
    v_pessoas := v_pessoas + v_qtd * v_lote.pessoas_por_unidade;
  end loop;

  if glam_festa_ocupada(p_festa_id) + v_pessoas > v_festa.lotacao then raise exception 'FESTA_LOTADA'; end if;

  if p_cupom is not null and length(trim(p_cupom)) > 0 then
    select * into v_cupom from glam_cupons where codigo = upper(trim(p_cupom)) for update;
    if not found or not v_cupom.ativo then raise exception 'CUPOM_INVALIDO'; end if;
    if v_cupom.valido_ate is not null and now() > v_cupom.valido_ate then raise exception 'CUPOM_EXPIRADO'; end if;
    if v_cupom.festa_id is not null and v_cupom.festa_id <> p_festa_id then raise exception 'CUPOM_INVALIDO'; end if;
    if v_cupom.usos_max is not null and v_cupom.usos + (
        select count(*) from glam_pedidos where cupom_id = v_cupom.id and status = 'pendente' and expira_em > now()
      ) >= v_cupom.usos_max then raise exception 'CUPOM_ESGOTADO'; end if;
    if v_cupom.limite_por_cliente is not null and (
        select count(*) from glam_pedidos where cupom_id = v_cupom.id and cliente_id = p_cliente_id
          and (status = 'pago' or (status = 'pendente' and expira_em > now()))
      ) >= v_cupom.limite_por_cliente then raise exception 'CUPOM_LIMITE_CLIENTE'; end if;
    if v_cupom.lote_id is not null then
      select coalesce(sum((e->>'quantidade')::int * l.preco_centavos), 0) into v_base_cupom
        from jsonb_array_elements(p_itens) e join glam_lotes l on l.id = (e->>'lote_id')::uuid where l.id = v_cupom.lote_id;
      if v_base_cupom = 0 then raise exception 'CUPOM_NAO_SE_APLICA'; end if;
    else
      v_base_cupom := v_subtotal;
    end if;
    if v_cupom.tipo = 'percentual' then v_desconto := round(v_base_cupom * least(v_cupom.valor, 100) / 100.0);
    else v_desconto := least(v_cupom.valor, v_base_cupom); end if;
  end if;

  if p_promoter is not null and length(trim(p_promoter)) > 0 then
    select id into v_promoter_id from glam_promoters where codigo = lower(trim(p_promoter)) and ativo;
  end if;

  loop
    v_codigo := glam_gerar_codigo_pedido();
    exit when not exists (select 1 from glam_pedidos where codigo = v_codigo);
  end loop;

  insert into glam_pedidos (codigo, festa_id, cliente_id, promoter_id, cupom_id, status, canal, metodo,
                            subtotal_centavos, desconto_centavos, total_centavos, criado_por, idempotency_key, acesso_hash)
  values (v_codigo, p_festa_id, p_cliente_id, v_promoter_id, v_cupom.id, 'pendente', p_canal, p_metodo,
          v_subtotal, v_desconto, greatest(v_subtotal - v_desconto, 0), p_staff_id, p_idempotencia, p_acesso_hash)
  returning id into v_pedido_id;

  insert into glam_pedido_itens (pedido_id, lote_id, quantidade, preco_unit_centavos, nomes)
  select v_pedido_id, (e->>'lote_id')::uuid, (e->>'quantidade')::int, l.preco_centavos,
         coalesce(array(select left(x, 80) from jsonb_array_elements_text(e->'nomes') x limit 200), '{}')
  from jsonb_array_elements(p_itens) e join glam_lotes l on l.id = (e->>'lote_id')::uuid;

  return jsonb_build_object('id', v_pedido_id, 'codigo', v_codigo,
    'subtotal', v_subtotal, 'desconto', v_desconto, 'total', greatest(v_subtotal - v_desconto, 0));
end $$;

-- 8) Ninguém de fora executa nada disso: só o servidor (service_role)
revoke all on function public.glam_limite(text, integer, integer) from public, anon, authenticated;
revoke all on function public.glam_registrar_evento(text, text) from public, anon, authenticated;
revoke all on function public.glam_criar_pedido_v2(uuid, uuid, jsonb, text, text, text, text, uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.glam_limite(text, integer, integer), public.glam_registrar_evento(text, text),
  public.glam_criar_pedido_v2(uuid, uuid, jsonb, text, text, text, text, uuid, boolean, text, text) to service_role;

-- 9) Tabelas glam_ invisíveis para anon/authenticated mesmo se alguém criar policy por engano
revoke all on public.glam_config, public.glam_staff, public.glam_festas, public.glam_lotes, public.glam_cupons,
  public.glam_promoters, public.glam_clientes, public.glam_pedidos, public.glam_pedido_itens, public.glam_ingressos,
  public.glam_lista, public.glam_acessos, public.glam_auditoria, public.glam_notificacoes, public.glam_limites,
  public.glam_webhook_eventos from anon, authenticated;

