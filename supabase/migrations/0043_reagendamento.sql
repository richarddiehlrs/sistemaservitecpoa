-- =====================================================================
-- 0043 — Reagendamento de visita
--  * agendamentos.status ganha 'reagendado' (a visita original fica no
--    histórico com o motivo; uma nova visita é criada na nova data)
--  * motivo_reagendamento / reagendado_para / reagendado_de
-- Rode no SQL Editor do Supabase APÓS 0042.
-- =====================================================================

alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check
  check (status in ('agendado', 'confirmado', 'em_atendimento', 'realizado', 'cancelado', 'reagendado'));

alter table public.agendamentos
  add column if not exists motivo_reagendamento text,
  add column if not exists reagendado_para date,
  add column if not exists reagendado_de uuid references public.agendamentos(id) on delete set null;

comment on column public.agendamentos.motivo_reagendamento is
  'tecnico_imprevisto | cliente_pediu | cliente_ausente | falta_peca | outro (+ detalhe)';
