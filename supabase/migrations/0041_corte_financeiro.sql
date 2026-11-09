-- =====================================================================
-- 0041 — Data de início do controle financeiro (corte)
--  * configuracoes.financeiro_inicio: a partir desta data, pendências,
--    "a receber" e previsões consideram os títulos; o que é anterior é
--    histórico (continua consultável).
--  * ordens_servico.encerrada_corte_em: OS antiga encerrada no corte
--    (serviço feito fora do controle, sem gerar faturamento nem pagamento).
-- Rode no SQL Editor do Supabase APÓS 0040.
-- =====================================================================

alter table public.configuracoes
  add column if not exists financeiro_inicio date;

comment on column public.configuracoes.financeiro_inicio is
  'Início do controle financeiro: títulos vencidos antes desta data não entram em pendências nem previsões.';

update public.configuracoes set financeiro_inicio = '2026-11-08' where id = 1 and financeiro_inicio is null;

alter table public.ordens_servico
  add column if not exists encerrada_corte_em timestamptz;

comment on column public.ordens_servico.encerrada_corte_em is
  'OS antiga encerrada no corte do financeiro (sem faturamento/pagamento gerado).';
