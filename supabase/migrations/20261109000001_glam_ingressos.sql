-- =====================================================================
-- GLAM House · Sistema de Ingressos
-- Todas as tabelas usam o prefixo glam_ e ficam com RLS ligado e SEM
-- políticas públicas: só o servidor (service role) lê e escreve.
-- =====================================================================

-- ---------- Configurações ----------
create table if not exists public.glam_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

insert into public.glam_config (chave, valor) values
  ('casa', jsonb_build_object(
     'nome', 'GLAM House',
     'slogan', 'A casinha mais amada de São Luís',
     'cidade', 'São Luís / MA',
     'endereco', '',
     'instagram', '@glamhouse',
     'whatsapp_casa', '5598985840529',
     'whatsapp_dono', '',
     'email_dono', '',
     'email_remetente', 'GLAM House <ingressos@glamhouse.com.br>',
     'evolution_instancia', 'glam',
     'comissao_padrao', 10
  ))
on conflict (chave) do nothing;

-- ---------- Equipe ----------
create table if not exists public.glam_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  papel text not null check (papel in ('dono','gerente','financeiro','portaria')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- Festas e lotes ----------
create table if not exists public.glam_festas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  subtitulo text,
  descricao text,
  cartaz_url text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  local_nome text default 'GLAM House',
  endereco text,
  lotacao integer not null default 500 check (lotacao > 0),
  mostrar_percentual boolean not null default false,
  classificacao text default '18+',
  status text not null default 'rascunho' check (status in ('rascunho','publicada','encerrada','cancelada')),
  lembrete_hoje_enviado_em timestamptz,
  relatorio_enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists glam_festas_data_idx on public.glam_festas (data_inicio);

create table if not exists public.glam_lotes (
  id uuid primary key default gen_random_uuid(),
  festa_id uuid not null references public.glam_festas(id) on delete cascade,
  setor text not null default 'pista',            -- pista, vip, camarote, mesa, meia...
  nome text not null,                             -- "1º lote", "Camarote Ouro"...
  descricao text,
  preco_centavos integer not null check (preco_centavos >= 0),
  capacidade integer not null check (capacidade >= 0),  -- unidades à venda
  pessoas_por_unidade integer not null default 1 check (pessoas_por_unidade between 1 and 50),
  max_por_pedido integer not null default 10 check (max_por_pedido > 0),
  ordem integer not null default 1,
  inicio_vendas timestamptz,
  fim_vendas timestamptz,
  ativo boolean not null default true,
  aviso_esgotado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists glam_lotes_festa_idx on public.glam_lotes (festa_id, setor, ordem);

-- ---------- Cupons e promoters ----------
create table if not exists public.glam_cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  festa_id uuid references public.glam_festas(id) on delete cascade,
  lote_id uuid references public.glam_lotes(id) on delete cascade,
  tipo text not null check (tipo in ('percentual','valor')),
  valor integer not null check (valor > 0),       -- % ou centavos
  usos_max integer,
  usos integer not null default 0,
  valido_ate timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.glam_promoters (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text not null unique,
  whatsapp text,
  email text,
  comissao_percentual numeric(5,2) not null default 10,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- Clientes ----------
create table if not exists public.glam_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  whatsapp text,
  cpf_cifrado text,      -- AES-256-GCM, chave fica só no servidor (LGPD)
  cpf_hash text,         -- HMAC para busca sem expor o CPF
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists glam_clientes_cpf_hash_idx on public.glam_clientes (cpf_hash);

-- ---------- Pedidos ----------
create table if not exists public.glam_pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  festa_id uuid not null references public.glam_festas(id),
  cliente_id uuid references public.glam_clientes(id),
  promoter_id uuid references public.glam_promoters(id),
  cupom_id uuid references public.glam_cupons(id),
  status text not null default 'pendente' check (status in ('pendente','pago','expirado','cancelado','reembolsado')),
  canal text not null default 'site' check (canal in ('site','balcao','cortesia')),
  metodo text check (metodo in ('pix','cartao','dinheiro','maquininha','cortesia')),
  subtotal_centavos integer not null default 0,
  desconto_centavos integer not null default 0,
  total_centavos integer not null default 0,
  pagbank_order_id text,
  pagbank_charge_id text,
  pix_copia_cola text,
  pix_qr_url text,
  expira_em timestamptz not null default (now() + interval '15 minutes'),
  pago_em timestamptz,
  lembrete_pix_enviado_em timestamptz,
  notificado_em timestamptz,
  criado_por uuid references public.glam_staff(id),
  cancelado_em timestamptz,
  cancelado_por uuid references public.glam_staff(id),
  motivo_cancelamento text,
  criado_em timestamptz not null default now()
);
create index if not exists glam_pedidos_festa_idx on public.glam_pedidos (festa_id, status);
create index if not exists glam_pedidos_status_idx on public.glam_pedidos (status, expira_em);
create index if not exists glam_pedidos_pago_idx on public.glam_pedidos (pago_em);

create table if not exists public.glam_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.glam_pedidos(id) on delete cascade,
  lote_id uuid not null references public.glam_lotes(id),
  quantidade integer not null check (quantidade > 0),
  preco_unit_centavos integer not null,
  nomes text[] not null default '{}'
);
create index if not exists glam_pedido_itens_lote_idx on public.glam_pedido_itens (lote_id);
create index if not exists glam_pedido_itens_pedido_idx on public.glam_pedido_itens (pedido_id);

-- ---------- Ingressos ----------
create table if not exists public.glam_ingressos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,         -- 144 bits aleatórios, não sequencial
  pedido_id uuid not null references public.glam_pedidos(id) on delete cascade,
  festa_id uuid not null references public.glam_festas(id),
  lote_id uuid not null references public.glam_lotes(id),
  nome_titular text not null,
  email_titular text,
  whatsapp_titular text,
  status text not null default 'ativo' check (status in ('ativo','cancelado')),
  checkin_em timestamptz,
  checkin_por uuid references public.glam_staff(id),
  transferencias integer not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists glam_ingressos_festa_idx on public.glam_ingressos (festa_id, status);
create index if not exists glam_ingressos_pedido_idx on public.glam_ingressos (pedido_id);
create index if not exists glam_ingressos_email_idx on public.glam_ingressos (lower(email_titular));

-- ---------- Lista de nomes ----------
create table if not exists public.glam_lista (
  id uuid primary key default gen_random_uuid(),
  festa_id uuid not null references public.glam_festas(id) on delete cascade,
  nome text not null,
  tipo text not null default 'lista' check (tipo in ('lista','vip','aniversario','promoter','cortesia')),
  promoter_id uuid references public.glam_promoters(id),
  observacao text,
  checkin_em timestamptz,
  checkin_por uuid references public.glam_staff(id),
  criado_por uuid references public.glam_staff(id),
  criado_em timestamptz not null default now()
);
create index if not exists glam_lista_festa_idx on public.glam_lista (festa_id, nome);

-- ---------- "Meus ingressos" sem senha ----------
create table if not exists public.glam_acessos (
  token_hash text primary key,
  email text not null,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------- Auditoria ----------
create table if not exists public.glam_auditoria (
  id bigserial primary key,
  staff_id uuid references public.glam_staff(id),
  staff_nome text,
  acao text not null,
  entidade text,
  entidade_id text,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists glam_auditoria_data_idx on public.glam_auditoria (criado_em desc);

-- ---------- Registro de notificações ----------
create table if not exists public.glam_notificacoes (
  id bigserial primary key,
  evento text not null,
  referencia text,
  status text not null default 'enviado',
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

-- ---------- RLS: tudo fechado para anon/authenticated ----------
alter table public.glam_config enable row level security;
alter table public.glam_staff enable row level security;
alter table public.glam_festas enable row level security;
alter table public.glam_lotes enable row level security;
alter table public.glam_cupons enable row level security;
alter table public.glam_promoters enable row level security;
alter table public.glam_clientes enable row level security;
alter table public.glam_pedidos enable row level security;
alter table public.glam_pedido_itens enable row level security;
alter table public.glam_ingressos enable row level security;
alter table public.glam_lista enable row level security;
alter table public.glam_acessos enable row level security;
alter table public.glam_auditoria enable row level security;
alter table public.glam_notificacoes enable row level security;

-- =====================================================================
-- Funções
-- =====================================================================

-- Unidades ainda disponíveis de um lote (pagos + reservas válidas contam)
create or replace function public.glam_lote_ocupado(p_lote_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(i.quantidade), 0)::int
  from glam_pedido_itens i
  join glam_pedidos p on p.id = i.pedido_id
  where i.lote_id = p_lote_id
    and (p.status = 'pago' or (p.status = 'pendente' and p.expira_em > now()));
$$;

-- Pessoas já garantidas numa festa (para a lotação total)
create or replace function public.glam_festa_ocupada(p_festa_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(i.quantidade * l.pessoas_por_unidade), 0)::int
  from glam_pedido_itens i
  join glam_pedidos p on p.id = i.pedido_id
  join glam_lotes l on l.id = i.lote_id
  where p.festa_id = p_festa_id
    and (p.status = 'pago' or (p.status = 'pendente' and p.expira_em > now()));
$$;

create or replace function public.glam_gerar_codigo(p_bytes int default 18)
returns text language sql volatile set search_path = public, extensions as $$
  select translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '+/=', '-_');
$$;

create or replace function public.glam_gerar_codigo_pedido()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(6);
  r text := 'GLM-';
  i int;
begin
  for i in 0..5 loop
    r := r || substr(alfabeto, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return r;
end $$;

-- Cria pedido com reserva atômica (sem venda acima da lotação)
-- p_itens: [{ "lote_id": uuid, "quantidade": int, "nomes": [text] }]
create or replace function public.glam_criar_pedido(
  p_festa_id uuid,
  p_cliente_id uuid,
  p_itens jsonb,
  p_cupom text default null,
  p_promoter text default null,
  p_canal text default 'site',
  p_metodo text default null,
  p_staff_id uuid default null,
  p_ignorar_janela boolean default false
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
  v_status text := 'pendente';
begin
  -- trava a festa para serializar compras simultâneas
  select * into v_festa from glam_festas where id = p_festa_id for update;
  if not found then raise exception 'FESTA_NAO_ENCONTRADA'; end if;
  if p_canal = 'site' and v_festa.status <> 'publicada' then raise exception 'FESTA_INDISPONIVEL'; end if;
  if v_festa.status in ('cancelada','encerrada') then raise exception 'FESTA_INDISPONIVEL'; end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'ITENS_INVALIDOS';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item->>'quantidade')::int;
    if v_qtd is null or v_qtd <= 0 then raise exception 'QUANTIDADE_INVALIDA'; end if;

    select * into v_lote from glam_lotes
      where id = (v_item->>'lote_id')::uuid and festa_id = p_festa_id
      for update;
    if not found then raise exception 'LOTE_INVALIDO'; end if;
    if not v_lote.ativo then raise exception 'LOTE_INDISPONIVEL:%', v_lote.nome; end if;
    if not p_ignorar_janela then
      if v_lote.inicio_vendas is not null and now() < v_lote.inicio_vendas then raise exception 'LOTE_NAO_INICIADO:%', v_lote.nome; end if;
      if v_lote.fim_vendas is not null and now() > v_lote.fim_vendas then raise exception 'LOTE_ENCERRADO:%', v_lote.nome; end if;
      if v_qtd > v_lote.max_por_pedido then raise exception 'LIMITE_POR_PEDIDO:%', v_lote.max_por_pedido; end if;
    end if;
    if glam_lote_ocupado(v_lote.id) + v_qtd > v_lote.capacidade then
      raise exception 'LOTE_ESGOTADO:%', v_lote.nome;
    end if;

    v_subtotal := v_subtotal + v_qtd * v_lote.preco_centavos;
    v_pessoas := v_pessoas + v_qtd * v_lote.pessoas_por_unidade;
  end loop;

  if glam_festa_ocupada(p_festa_id) + v_pessoas > v_festa.lotacao then
    raise exception 'FESTA_LOTADA';
  end if;

  -- cupom
  if p_cupom is not null and length(trim(p_cupom)) > 0 then
    select * into v_cupom from glam_cupons where codigo = upper(trim(p_cupom)) for update;
    if not found or not v_cupom.ativo then raise exception 'CUPOM_INVALIDO'; end if;
    if v_cupom.valido_ate is not null and now() > v_cupom.valido_ate then raise exception 'CUPOM_EXPIRADO'; end if;
    if v_cupom.festa_id is not null and v_cupom.festa_id <> p_festa_id then raise exception 'CUPOM_INVALIDO'; end if;
    if v_cupom.usos_max is not null and v_cupom.usos + (
        select count(*) from glam_pedidos where cupom_id = v_cupom.id and status = 'pendente' and expira_em > now()
      ) >= v_cupom.usos_max then
      raise exception 'CUPOM_ESGOTADO';
    end if;
    if v_cupom.lote_id is not null then
      select coalesce(sum((e->>'quantidade')::int * l.preco_centavos), 0) into v_base_cupom
        from jsonb_array_elements(p_itens) e join glam_lotes l on l.id = (e->>'lote_id')::uuid
        where l.id = v_cupom.lote_id;
      if v_base_cupom = 0 then raise exception 'CUPOM_NAO_SE_APLICA'; end if;
    else
      v_base_cupom := v_subtotal;
    end if;
    if v_cupom.tipo = 'percentual' then
      v_desconto := round(v_base_cupom * least(v_cupom.valor, 100) / 100.0);
    else
      v_desconto := least(v_cupom.valor, v_base_cupom);
    end if;
  end if;

  if p_promoter is not null and length(trim(p_promoter)) > 0 then
    select id into v_promoter_id from glam_promoters where codigo = lower(trim(p_promoter)) and ativo;
  end if;

  loop
    v_codigo := glam_gerar_codigo_pedido();
    exit when not exists (select 1 from glam_pedidos where codigo = v_codigo);
  end loop;

  insert into glam_pedidos (codigo, festa_id, cliente_id, promoter_id, cupom_id, status, canal, metodo,
                            subtotal_centavos, desconto_centavos, total_centavos, criado_por)
  values (v_codigo, p_festa_id, p_cliente_id, v_promoter_id, v_cupom.id, v_status, p_canal, p_metodo,
          v_subtotal, v_desconto, greatest(v_subtotal - v_desconto, 0), p_staff_id)
  returning id into v_pedido_id;

  insert into glam_pedido_itens (pedido_id, lote_id, quantidade, preco_unit_centavos, nomes)
  select v_pedido_id, (e->>'lote_id')::uuid, (e->>'quantidade')::int, l.preco_centavos,
         coalesce(array(select jsonb_array_elements_text(e->'nomes')), '{}')
  from jsonb_array_elements(p_itens) e
  join glam_lotes l on l.id = (e->>'lote_id')::uuid;

  return jsonb_build_object('id', v_pedido_id, 'codigo', v_codigo,
    'subtotal', v_subtotal, 'desconto', v_desconto, 'total', greatest(v_subtotal - v_desconto, 0));
end $$;

-- Confirma pagamento e emite ingressos (idempotente).
-- Retorna { confirmado_agora: bool, lotes_esgotados: [ids] }
create or replace function public.glam_confirmar_pedido(
  p_pedido_id uuid,
  p_charge_id text default null,
  p_metodo text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pedido glam_pedidos%rowtype;
  v_cliente glam_clientes%rowtype;
  v_item record;
  v_n int;
  v_nome text;
  v_esgotados uuid[] := '{}';
begin
  select * into v_pedido from glam_pedidos where id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO'; end if;
  if v_pedido.status = 'pago' then
    return jsonb_build_object('confirmado_agora', false, 'lotes_esgotados', '[]'::jsonb);
  end if;
  if v_pedido.status in ('cancelado','reembolsado') then raise exception 'PEDIDO_CANCELADO'; end if;

  select * into v_cliente from glam_clientes where id = v_pedido.cliente_id;

  update glam_pedidos set status = 'pago', pago_em = now(),
    pagbank_charge_id = coalesce(p_charge_id, pagbank_charge_id),
    metodo = coalesce(p_metodo, metodo)
  where id = p_pedido_id;

  if v_pedido.cupom_id is not null then
    update glam_cupons set usos = usos + 1 where id = v_pedido.cupom_id;
  end if;

  for v_item in
    select i.*, l.pessoas_por_unidade, l.nome as lote_nome
    from glam_pedido_itens i join glam_lotes l on l.id = i.lote_id
    where i.pedido_id = p_pedido_id
  loop
    for v_n in 1 .. (v_item.quantidade * v_item.pessoas_por_unidade) loop
      v_nome := nullif(trim(coalesce(v_item.nomes[v_n], '')), '');
      if v_nome is null then
        v_nome := coalesce(v_cliente.nome, 'Convidado') ||
                  case when v_n > 1 then ' (' || v_n || ')' else '' end;
      end if;
      insert into glam_ingressos (codigo, pedido_id, festa_id, lote_id, nome_titular, email_titular, whatsapp_titular)
      values (glam_gerar_codigo(18), p_pedido_id, v_pedido.festa_id, v_item.lote_id, v_nome,
              v_cliente.email, v_cliente.whatsapp);
    end loop;

    -- lote esgotou agora?
    if (select glam_lote_ocupado(v_item.lote_id)) >= (select capacidade from glam_lotes where id = v_item.lote_id)
       and (select aviso_esgotado_em from glam_lotes where id = v_item.lote_id) is null then
      update glam_lotes set aviso_esgotado_em = now() where id = v_item.lote_id;
      v_esgotados := array_append(v_esgotados, v_item.lote_id);
    end if;
  end loop;

  return jsonb_build_object('confirmado_agora', true, 'lotes_esgotados', to_jsonb(v_esgotados));
end $$;

-- Check-in atômico: cada ingresso entra uma vez só
create or replace function public.glam_checkin(p_codigo text, p_festa_id uuid, p_staff_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ing glam_ingressos%rowtype;
  v_lote_nome text;
  v_setor text;
begin
  select * into v_ing from glam_ingressos where codigo = p_codigo for update;
  if not found then return jsonb_build_object('resultado', 'invalido'); end if;
  select nome, setor into v_lote_nome, v_setor from glam_lotes where id = v_ing.lote_id;
  if v_ing.festa_id <> p_festa_id then
    return jsonb_build_object('resultado', 'outra_festa', 'nome', v_ing.nome_titular);
  end if;
  if v_ing.status <> 'ativo' then
    return jsonb_build_object('resultado', 'cancelado', 'nome', v_ing.nome_titular);
  end if;
  if v_ing.checkin_em is not null then
    return jsonb_build_object('resultado', 'ja_utilizado', 'nome', v_ing.nome_titular,
      'checkin_em', v_ing.checkin_em, 'lote', v_lote_nome, 'setor', v_setor);
  end if;
  update glam_ingressos set checkin_em = now(), checkin_por = p_staff_id where id = v_ing.id;
  return jsonb_build_object('resultado', 'ok', 'nome', v_ing.nome_titular, 'lote', v_lote_nome, 'setor', v_setor);
end $$;

-- Expira reservas vencidas
create or replace function public.glam_expirar_pedidos()
returns integer language sql security definer set search_path = public as $$
  with x as (
    update glam_pedidos set status = 'expirado'
    where status = 'pendente' and expira_em < now() - interval '2 minutes'
    returning 1
  ) select count(*)::int from x;
$$;

-- Resumo financeiro por período
create or replace function public.glam_resumo(p_inicio timestamptz, p_fim timestamptz, p_festa_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pedidos', count(*),
    'faturamento', coalesce(sum(total_centavos), 0),
    'descontos', coalesce(sum(desconto_centavos), 0),
    'pix', coalesce(sum(total_centavos) filter (where metodo = 'pix'), 0),
    'cartao', coalesce(sum(total_centavos) filter (where metodo = 'cartao'), 0),
    'balcao', coalesce(sum(total_centavos) filter (where canal = 'balcao'), 0),
    'ingressos', coalesce((select count(*) from glam_ingressos g join glam_pedidos p2 on p2.id = g.pedido_id
                  where p2.status = 'pago' and p2.pago_em between p_inicio and p_fim
                  and (p_festa_id is null or p2.festa_id = p_festa_id) and g.status = 'ativo'), 0)
  )
  from glam_pedidos
  where status = 'pago' and pago_em between p_inicio and p_fim
    and (p_festa_id is null or festa_id = p_festa_id);
$$;

-- Ninguém de fora chama as funções: só o service role
revoke all on function public.glam_lote_ocupado(uuid) from public, anon, authenticated;
revoke all on function public.glam_festa_ocupada(uuid) from public, anon, authenticated;
revoke all on function public.glam_gerar_codigo(int) from public, anon, authenticated;
revoke all on function public.glam_gerar_codigo_pedido() from public, anon, authenticated;
revoke all on function public.glam_criar_pedido(uuid, uuid, jsonb, text, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.glam_confirmar_pedido(uuid, text, text) from public, anon, authenticated;
revoke all on function public.glam_checkin(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.glam_expirar_pedidos() from public, anon, authenticated;
revoke all on function public.glam_resumo(timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.glam_lote_ocupado(uuid), public.glam_festa_ocupada(uuid),
  public.glam_gerar_codigo(int), public.glam_gerar_codigo_pedido(),
  public.glam_criar_pedido(uuid, uuid, jsonb, text, text, text, text, uuid, boolean),
  public.glam_confirmar_pedido(uuid, text, text), public.glam_checkin(text, uuid, uuid),
  public.glam_expirar_pedidos(), public.glam_resumo(timestamptz, timestamptz, uuid) to service_role;

-- Bucket público para cartazes (upload só pelo servidor)
insert into storage.buckets (id, name, public)
values ('glam-cartazes', 'glam-cartazes', true)
on conflict (id) do nothing;

-- Expira reservas a cada minuto
select cron.schedule('glam-expirar-pedidos', '* * * * *', $$select public.glam_expirar_pedidos();$$);
