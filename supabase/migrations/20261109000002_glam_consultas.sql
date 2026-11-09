create or replace function public.glam_lotes_status(p_festa_id uuid)
returns table (lote_id uuid, ocupado int)
language sql stable security definer set search_path = public as $$
  select l.id, coalesce((
    select sum(i.quantidade) from glam_pedido_itens i join glam_pedidos p on p.id = i.pedido_id
    where i.lote_id = l.id and (p.status = 'pago' or (p.status = 'pendente' and p.expira_em > now()))
  ), 0)::int
  from glam_lotes l where l.festa_id = p_festa_id;
$$;

create or replace function public.glam_festa_contadores(p_festa_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ingressos', (select count(*) from glam_ingressos where festa_id = p_festa_id and status = 'ativo'),
    'entraram', (select count(*) from glam_ingressos where festa_id = p_festa_id and status = 'ativo' and checkin_em is not null),
    'lista', (select count(*) from glam_lista where festa_id = p_festa_id),
    'lista_entraram', (select count(*) from glam_lista where festa_id = p_festa_id and checkin_em is not null),
    'ocupado', glam_festa_ocupada(p_festa_id),
    'faturamento', (select coalesce(sum(total_centavos),0) from glam_pedidos where festa_id = p_festa_id and status = 'pago')
  );
$$;

create or replace function public.glam_faturamento_diario(p_inicio timestamptz, p_fim timestamptz)
returns table (dia date, total bigint, pedidos int)
language sql stable security definer set search_path = public as $$
  select (pago_em at time zone 'America/Sao_Paulo')::date as dia, sum(total_centavos)::bigint, count(*)::int
  from glam_pedidos where status = 'pago' and pago_em between p_inicio and p_fim
  group by 1 order by 1;
$$;

revoke all on function public.glam_lotes_status(uuid) from public, anon, authenticated;
revoke all on function public.glam_festa_contadores(uuid) from public, anon, authenticated;
revoke all on function public.glam_faturamento_diario(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.glam_lotes_status(uuid), public.glam_festa_contadores(uuid),
  public.glam_faturamento_diario(timestamptz, timestamptz) to service_role;
