-- =====================================================================
-- ServitecPoa ERP - Técnico: check-in/out, despesas de campo, permissões
-- Rode no SQL Editor do Supabase APÓS 0007.
-- =====================================================================

-- Check-in / check-out na agenda
alter table public.agendamentos
  add column if not exists checkin_at   timestamptz,
  add column if not exists checkout_at  timestamptz,
  add column if not exists checkin_por  uuid references auth.users(id) on delete set null;

-- Novo status: em_atendimento (entre check-in e check-out)
alter table public.agendamentos
  drop constraint if exists agendamentos_status_check;
alter table public.agendamentos
  add constraint agendamentos_status_check
  check (status in ('agendado','confirmado','em_atendimento','realizado','cancelado'));

-- Lançamentos: quem criou e origem (sistema vs campo/técnico)
alter table public.lancamentos_financeiros
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists origem text not null default 'sistema'
    check (origem in ('sistema','campo'));

-- Categorias de despesa de campo
insert into public.categorias_financeiras (nome, tipo, grupo_dre)
select v.nome, 'despesa', v.grupo
from (values
  ('Alimentação / refeição', 'despesa_operacional'),
  ('Despesas de campo (técnico)', 'despesa_operacional')
) as v(nome, grupo)
where not exists (
  select 1 from public.categorias_financeiras c where c.nome = v.nome
);
