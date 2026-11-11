-- Clientes (CRM): consentimento de novidades (LGPD), histórico de disparos e resumo por cliente.
alter table public.glam_clientes add column if not exists aceita_marketing boolean not null default false;
alter table public.glam_clientes add column if not exists marketing_em timestamptz;
alter table public.glam_clientes add column if not exists descadastro_em timestamptz;

create table if not exists public.glam_disparos (
  id uuid primary key default gen_random_uuid(),
  assunto text not null,
  mensagem text not null,
  publico jsonb not null default '{}'::jsonb,
  total integer not null default 0,
  enviados integer not null default 0,
  falhas integer not null default 0,
  status text not null default 'enviando' check (status in ('enviando','concluido','falhou')),
  criado_por uuid references public.glam_staff(id),
  criado_em timestamptz not null default now()
);
alter table public.glam_disparos enable row level security;
revoke all on public.glam_disparos from anon, authenticated;

create or replace function public.glam_clientes_resumo(p_busca text default null, p_min_compras integer default 0, p_festa_id uuid default null, p_so_marketing boolean default false, p_limite integer default 500)
returns table (id uuid, nome text, email text, whatsapp text, aceita_marketing boolean, compras integer, ingressos integer, total_centavos bigint, primeira_compra timestamptz, ultima_compra timestamptz, festas text[], criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  with comp as (
    select p.cliente_id,
      count(*)::int as compras,
      coalesce(sum(p.total_centavos),0)::bigint as total,
      min(p.pago_em) as primeira, max(p.pago_em) as ultima,
      array_agg(distinct f.titulo) as festas,
      bool_or(p_festa_id is not null and p.festa_id = p_festa_id) as foi_na_festa
    from glam_pedidos p join glam_festas f on f.id = p.festa_id
    where p.status = 'pago'
    group by p.cliente_id
  ), ing as (
    select p.cliente_id, count(*)::int as n
    from glam_ingressos i join glam_pedidos p on p.id = i.pedido_id
    where p.status = 'pago' and i.status = 'ativo'
    group by p.cliente_id
  )
  select c.id, c.nome, c.email, c.whatsapp, c.aceita_marketing,
    coalesce(comp.compras,0), coalesce(ing.n,0), coalesce(comp.total,0),
    comp.primeira, comp.ultima, coalesce(comp.festas, '{}'), c.criado_em
  from glam_clientes c
  left join comp on comp.cliente_id = c.id
  left join ing on ing.cliente_id = c.id
  where (p_busca is null or p_busca = '' or c.nome ilike '%' || p_busca || '%' or c.email ilike '%' || p_busca || '%' or c.whatsapp like '%' || regexp_replace(p_busca, '\D', '', 'g') || '%' and regexp_replace(p_busca, '\D', '', 'g') <> '')
    and coalesce(comp.compras,0) >= coalesce(p_min_compras,0)
    and (p_festa_id is null or coalesce(comp.foi_na_festa,false))
    and (not p_so_marketing or (c.aceita_marketing and c.descadastro_em is null))
  order by coalesce(comp.compras,0) desc, comp.ultima desc nulls last, c.criado_em desc
  limit greatest(1, least(coalesce(p_limite,500), 20000));
$$;
revoke all on function public.glam_clientes_resumo(text, integer, uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.glam_clientes_resumo(text, integer, uuid, boolean, integer) to service_role;
