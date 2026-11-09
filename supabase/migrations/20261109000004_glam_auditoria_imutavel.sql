-- 5) Auditoria imutável: ninguém edita nem apaga (nem o dono, nem o servidor)
create or replace function public.glam_bloquear_alteracao()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'glam_auditoria aceita apenas inserção';
end $$;
create or replace trigger glam_auditoria_imutavel before update or delete on public.glam_auditoria
  for each row execute function public.glam_bloquear_alteracao();
create or replace trigger glam_auditoria_sem_truncate before truncate on public.glam_auditoria
  for each statement execute function public.glam_bloquear_alteracao();

-- 6) Trilha automática no banco para tabelas críticas (sem colunas sensíveis)
create or replace function public.glam_auditar_linha()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb;
begin
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old) - array['cpf_cifrado','cpf_hash','acesso_hash']; end if;
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new) - array['cpf_cifrado','cpf_hash','acesso_hash']; end if;
  insert into public.glam_auditoria (staff_nome, acao, entidade, entidade_id, detalhes)
  values ('banco', 'db_' || lower(tg_op), tg_table_name, coalesce(v_new->>'id', v_old->>'id', v_new->>'chave', v_old->>'chave'),
          jsonb_build_object('antes', v_old, 'depois', v_new));
  return coalesce(new, old);
end $$;

create or replace trigger glam_staff_auditoria after insert or update or delete on public.glam_staff
  for each row execute function public.glam_auditar_linha();
create or replace trigger glam_config_auditoria after insert or update or delete on public.glam_config
  for each row execute function public.glam_auditar_linha();
create or replace trigger glam_lotes_auditoria after update or delete on public.glam_lotes
  for each row execute function public.glam_auditar_linha();
create or replace trigger glam_cupons_auditoria after insert or update or delete on public.glam_cupons
  for each row execute function public.glam_auditar_linha();

revoke all on function public.glam_auditar_linha() from public, anon, authenticated;
revoke all on function public.glam_bloquear_alteracao() from public, anon, authenticated;

-- Limpeza horária: janelas de limite antigas, links de acesso vencidos e eventos de webhook antigos
create or replace function public.glam_limpeza()
returns void language sql security definer set search_path = '' as $$
  delete from public.glam_limites where janela < now() - interval '1 day';
  delete from public.glam_acessos where expira_em < now() - interval '7 days';
  delete from public.glam_webhook_eventos where recebido_em < now() - interval '90 days';
$$;
revoke all on function public.glam_limpeza() from public, anon, authenticated;
select cron.schedule('glam-limpeza', '17 * * * *', $$select public.glam_limpeza();$$);
