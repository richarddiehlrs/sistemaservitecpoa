-- Corrige RLS: técnico assume OS/agenda sem tecnico_id; operação lê profiles
-- Rode APÓS 0025_rls_operacional.sql

create or replace function public.os_do_tecnico(p_os_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ordens_servico o
    where o.id = p_os_id
    and (
      o.tecnico_id = auth.uid()
      or (public.meu_papel() = 'tecnico' and o.tecnico_id is null)
    )
  );
$$;

create or replace function public.ag_do_tecnico(p_ag_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agendamentos a
    where a.id = p_ag_id
    and (
      a.tecnico_id = auth.uid()
      or a.checkin_por = auth.uid()
      or (public.meu_papel() = 'tecnico' and a.tecnico_id is null)
    )
  );
$$;

-- ---- ordens_servico: técnico assume OS sem vínculo ----
drop policy if exists os_select on public.ordens_servico;
drop policy if exists os_update on public.ordens_servico;

create policy os_select on public.ordens_servico
  for select to authenticated
  using (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
    or (public.meu_papel() = 'tecnico' and tecnico_id is null)
  );

create policy os_update on public.ordens_servico
  for update to authenticated
  using (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
    or (public.meu_papel() = 'tecnico' and tecnico_id is null)
  )
  with check (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
  );

-- ---- agendamentos: check-in/check-out do técnico ----
drop policy if exists ag_select on public.agendamentos;
drop policy if exists ag_update on public.agendamentos;
drop policy if exists ag_insert on public.agendamentos;

create policy ag_select on public.agendamentos
  for select to authenticated
  using (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
    or checkin_por = auth.uid()
    or (public.meu_papel() = 'tecnico' and tecnico_id is null)
  );

create policy ag_insert on public.agendamentos
  for insert to authenticated
  with check (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
    or public.meu_papel() = 'tecnico'
  );

create policy ag_update on public.agendamentos
  for update to authenticated
  using (
    public.pode_operacao_erp()
    or public.ag_do_tecnico(id)
  )
  with check (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
  );

-- ---- profiles: atendente/admin listam técnicos (relatórios, agenda) ----
drop policy if exists prof_select_operacao on public.profiles;
create policy prof_select_operacao on public.profiles
  for select to authenticated
  using (public.pode_operacao_erp() or id = auth.uid());
