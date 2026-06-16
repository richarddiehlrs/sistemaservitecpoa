-- RLS operacional: OS, agenda, clientes e itens por papel/atribuição
-- Rode APÓS 0024_correcoes_seguranca.sql

create or replace function public.pode_operacao_erp()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.meu_papel() in ('admin', 'atendente');
$$;

create or replace function public.os_do_tecnico(p_os_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ordens_servico o
    where o.id = p_os_id and o.tecnico_id = auth.uid()
  );
$$;

-- ---- ordens_servico ----
drop policy if exists "auth_all_ordens_servico" on public.ordens_servico;

create policy os_select on public.ordens_servico
  for select to authenticated
  using (public.pode_operacao_erp() or tecnico_id = auth.uid());

create policy os_insert on public.ordens_servico
  for insert to authenticated
  with check (
    public.pode_operacao_erp()
    or (public.meu_papel() = 'tecnico' and (tecnico_id is null or tecnico_id = auth.uid()))
  );

create policy os_update on public.ordens_servico
  for update to authenticated
  using (public.pode_operacao_erp() or tecnico_id = auth.uid())
  with check (public.pode_operacao_erp() or tecnico_id = auth.uid());

create policy os_delete on public.ordens_servico
  for delete to authenticated
  using (public.meu_papel() = 'admin');

-- ---- agendamentos ----
drop policy if exists "auth_all_agendamentos" on public.agendamentos;

create policy ag_select on public.agendamentos
  for select to authenticated
  using (public.pode_operacao_erp() or tecnico_id = auth.uid());

create policy ag_insert on public.agendamentos
  for insert to authenticated
  with check (public.pode_operacao_erp() or tecnico_id = auth.uid());

create policy ag_update on public.agendamentos
  for update to authenticated
  using (public.pode_operacao_erp() or tecnico_id = auth.uid())
  with check (public.pode_operacao_erp() or tecnico_id = auth.uid());

create policy ag_delete on public.agendamentos
  for delete to authenticated
  using (public.pode_operacao_erp());

-- ---- os_itens ----
drop policy if exists "auth_all_os_itens" on public.os_itens;

create policy os_itens_all on public.os_itens
  for all to authenticated
  using (public.pode_operacao_erp() or public.os_do_tecnico(os_id))
  with check (public.pode_operacao_erp() or public.os_do_tecnico(os_id));

-- ---- os_status_historico ----
drop policy if exists "auth_all_os_status_historico" on public.os_status_historico;

create policy os_hist_all on public.os_status_historico
  for all to authenticated
  using (public.pode_operacao_erp() or public.os_do_tecnico(os_id))
  with check (public.pode_operacao_erp() or public.os_do_tecnico(os_id));

-- ---- os_equipamentos ----
drop policy if exists "Authenticated users can manage os_equipamentos" on public.os_equipamentos;

create policy os_equip_all on public.os_equipamentos
  for all to authenticated
  using (public.pode_operacao_erp() or public.os_do_tecnico(os_id))
  with check (public.pode_operacao_erp() or public.os_do_tecnico(os_id));

-- ---- clientes: técnico lê/cria; alteração/exclusão só operação ----
drop policy if exists "auth_all_clientes" on public.clientes;

create policy cli_select on public.clientes
  for select to authenticated using (true);

create policy cli_insert on public.clientes
  for insert to authenticated with check (true);

create policy cli_update on public.clientes
  for update to authenticated
  using (public.pode_operacao_erp())
  with check (public.pode_operacao_erp());

create policy cli_delete on public.clientes
  for delete to authenticated
  using (public.pode_operacao_erp());

-- ---- equipamentos ----
drop policy if exists "auth_all_equipamentos" on public.equipamentos;

create policy equip_select on public.equipamentos
  for select to authenticated using (true);

create policy equip_write on public.equipamentos
  for all to authenticated
  using (public.pode_operacao_erp())
  with check (public.pode_operacao_erp());

-- ---- os_anexos ----
drop policy if exists "Authenticated users can manage os_anexos" on public.os_anexos;

create policy os_anexos_all on public.os_anexos
  for all to authenticated
  using (public.pode_operacao_erp() or public.os_do_tecnico(os_id))
  with check (public.pode_operacao_erp() or public.os_do_tecnico(os_id));
