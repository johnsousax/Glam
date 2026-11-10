-- Situações da festa escolhidas no painel:
-- publicada = Ativo (à venda) · inativa = aparece no site, vendas fechadas · esgotada = aparece como esgotado
-- rascunho = Oculto (não aparece) · encerrada / cancelada continuam como antes.
alter table public.glam_festas drop constraint if exists glam_festas_status_check;
alter table public.glam_festas add constraint glam_festas_status_check
  check (status in ('rascunho','publicada','inativa','esgotada','encerrada','cancelada'));
