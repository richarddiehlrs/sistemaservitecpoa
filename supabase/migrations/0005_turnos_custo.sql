-- =====================================================================
-- ServitecPoa ERP - Turnos (manhã/tarde), custo por item e lucro
-- Rode no SQL Editor do Supabase APÓS 0004.
-- =====================================================================

-- Turno na agenda
alter table public.agendamentos
  add column if not exists turno text check (turno in ('manha','tarde','dia'));

-- Turno e custo na OS
alter table public.ordens_servico
  add column if not exists turno text check (turno in ('manha','tarde','dia')),
  add column if not exists custo_total numeric(12,2) not null default 0;

-- Custo unitário por item (preço que a empresa pagou)
alter table public.os_itens
  add column if not exists custo_unitario numeric(12,2) not null default 0;
