-- Todo comprador entra na lista de disparos (sem caixinha no checkout);
-- só sai quem clicar em "não quero mais receber" (descadastro_em preenchido).
alter table public.glam_clientes alter column aceita_marketing set default true;
update public.glam_clientes
   set aceita_marketing = true, marketing_em = coalesce(marketing_em, criado_em)
 where descadastro_em is null and aceita_marketing = false;
