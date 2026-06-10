-- =====================================================================
-- ServitecPoa ERP - Centro de notificações + preferências de alertas
-- Rode no SQL Editor do Supabase APÓS 0013.
-- =====================================================================

create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tipo        text not null check (tipo in (
    'os_nova', 'os_aprovada', 'os_status', 'cliente_ausente',
    'despesa_campo', 'financeiro', 'oficina_parada', 'meta_faturamento', 'sistema'
  )),
  titulo      text not null,
  mensagem    text not null,
  url         text,
  prioridade  text not null default 'normal'
    check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  lida        boolean not null default false,
  lida_em     timestamptz,
  ref_tipo    text,
  ref_id      uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notificacoes_user_lida on public.notificacoes (user_id, lida, created_at desc);
create index if not exists idx_notificacoes_ref on public.notificacoes (ref_tipo, ref_id);

create table if not exists public.preferencias_alertas (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  push_ativo           boolean not null default true,
  os_nova              boolean not null default true,
  os_aprovada          boolean not null default true,
  cliente_ausente      boolean not null default true,
  despesa_campo        boolean not null default true,
  financeiro           boolean not null default true,
  oficina_parada       boolean not null default true,
  meta_faturamento     boolean not null default true,
  email_resumo         boolean not null default false,
  dias_oficina_parada  int not null default 2 check (dias_oficina_parada between 1 and 30),
  updated_at           timestamptz not null default now()
);

create trigger trg_preferencias_alertas_updated_at
  before update on public.preferencias_alertas
  for each row execute function public.set_updated_at();

alter table public.notificacoes enable row level security;
alter table public.preferencias_alertas enable row level security;

drop policy if exists "notificacoes_own_select" on public.notificacoes;
create policy "notificacoes_own_select" on public.notificacoes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notificacoes_own_update" on public.notificacoes;
create policy "notificacoes_own_update" on public.notificacoes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "preferencias_own" on public.preferencias_alertas;
create policy "preferencias_own" on public.preferencias_alertas
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on public.notificacoes to authenticated;
grant select, insert, update on public.preferencias_alertas to authenticated;

-- Realtime no sino
do $$
begin
  alter publication supabase_realtime add table public.notificacoes;
exception
  when duplicate_object then null;
end $$;

comment on table public.notificacoes is 'Histórico de alertas por usuário (eventos do ERP).';
comment on table public.preferencias_alertas is 'Preferências de alertas e push por usuário.';
