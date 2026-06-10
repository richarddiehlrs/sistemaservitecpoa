-- =====================================================================
-- ServitecPoa ERP - GPS do técnico (check-in/out + posição em tempo real)
-- Rode no SQL Editor do Supabase APÓS 0008.
-- =====================================================================

-- Coordenadas no check-in / check-out do atendimento
alter table public.agendamentos
  add column if not exists checkin_lat   numeric(10, 7),
  add column if not exists checkin_lng   numeric(10, 7),
  add column if not exists checkout_lat  numeric(10, 7),
  add column if not exists checkout_lng  numeric(10, 7);

-- Última posição conhecida de cada técnico (atualizada pelo PWA em campo)
create table if not exists public.posicoes_tecnico (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  tecnico_nome  text,
  lat           numeric(10, 7) not null,
  lng           numeric(10, 7) not null,
  precisao      numeric(8, 2),
  em_atendimento boolean not null default false,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  atualizado_at timestamptz not null default now()
);

create index if not exists idx_posicoes_atualizado on public.posicoes_tecnico (atualizado_at desc);

alter table public.posicoes_tecnico enable row level security;

drop policy if exists posicoes_tecnico_all on public.posicoes_tecnico;
create policy posicoes_tecnico_all on public.posicoes_tecnico
  for all using (true) with check (true);
