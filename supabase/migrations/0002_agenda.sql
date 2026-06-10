-- =====================================================================
-- ServitecPoa ERP - Agenda de atendimentos
-- Rode este script no SQL Editor do Supabase APÓS o 0001_init.sql
-- =====================================================================

create table if not exists public.agendamentos (
  id            uuid primary key default gen_random_uuid(),
  os_id         uuid references public.ordens_servico(id) on delete set null,
  cliente_id    uuid references public.clientes(id) on delete set null,
  titulo        text not null,
  tipo          text not null default 'visita'
                check (tipo in ('visita','coleta','entrega','retorno','orcamento','outro')),
  data          date not null,
  hora_inicio   time,
  hora_fim      time,
  tecnico       text,
  endereco      text,
  status        text not null default 'agendado'
                check (status in ('agendado','confirmado','realizado','cancelado')),
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_agendamentos_data on public.agendamentos (data);
create index if not exists idx_agendamentos_cliente on public.agendamentos (cliente_id);
create index if not exists idx_agendamentos_os on public.agendamentos (os_id);
create index if not exists idx_agendamentos_status on public.agendamentos (status);

create trigger trg_agendamentos_updated_at
  before update on public.agendamentos
  for each row execute function public.set_updated_at();

-- RLS
alter table public.agendamentos enable row level security;
drop policy if exists "auth_all_agendamentos" on public.agendamentos;
create policy "auth_all_agendamentos" on public.agendamentos
  for all to authenticated using (true) with check (true);

-- Privilégios (Data API)
grant select, insert, update, delete on public.agendamentos to authenticated;
