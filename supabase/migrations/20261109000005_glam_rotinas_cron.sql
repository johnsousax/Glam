-- Rotinas agendadas no banco: pg_cron chama o site (pg_net) com o segredo guardado no Vault.
-- O segredo é criado fora do Git:  select vault.create_secret('<GLAM_AUTOMACAO_SECRET>', 'glam_automacao_secret');
create or replace function public.glam_chamar_rotina(p_acao text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_segredo text;
begin
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'glam_automacao_secret';
  if v_segredo is null then return null; end if;
  return net.http_post(
    url := 'https://glam-ingressos.vercel.app/api/n8n/' || p_acao,
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-glam-secret', v_segredo),
    timeout_milliseconds := 55000
  );
end $$;
revoke all on function public.glam_chamar_rotina(text) from public, anon, authenticated;

select cron.schedule('glam-pix-pendentes', '*/3 * * * *', $$select public.glam_chamar_rotina('pix-pendentes');$$);
select cron.schedule('glam-e-hoje',        '0 13 * * *',  $$select public.glam_chamar_rotina('festas-hoje');$$);   -- 10h Brasília
select cron.schedule('glam-pos-festa',     '0 14 * * *',  $$select public.glam_chamar_rotina('pos-festa');$$);     -- 11h Brasília
select cron.schedule('glam-backup',        '0 7 * * *',   $$select public.glam_chamar_rotina('backup');$$);        -- 4h Brasília
select cron.schedule('glam-config-n8n',    '30 */6 * * *', $$select public.glam_chamar_rotina('config');$$);
