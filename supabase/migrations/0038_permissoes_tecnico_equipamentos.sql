-- 0038 — Técnico abre OS com equipamento (reaplica permissões, idempotente)
-- Garante que o técnico consiga: cadastrar equipamento do cliente, ver
-- equipamentos e vincular o equipamento às OS dele. Rode no SQL Editor.

alter table public.equipamentos enable row level security;
alter table public.os_equipamentos enable row level security;

-- Equipamentos: todos os usuários logados leem; operação e técnico cadastram
drop policy if exists "auth_all_equipamentos" on public.equipamentos;
drop policy if exists equip_write on public.equipamentos;
drop policy if exists equip_select on public.equipamentos;
drop policy if exists equip_insert on public.equipamentos;
drop policy if exists equip_update on public.equipamentos;
drop policy if exists equip_delete on public.equipamentos;

create policy equip_select on public.equipamentos
  for select to authenticated using (true);

create policy equip_insert on public.equipamentos
  for insert to authenticated
  with check (public.pode_operacao_erp() or public.meu_papel() = 'tecnico');

-- Técnico pode corrigir dados do equipamento de clientes das OS dele
create policy equip_update on public.equipamentos
  for update to authenticated
  using (
    public.pode_operacao_erp()
    or (
      public.meu_papel() = 'tecnico'
      and exists (
        select 1 from public.ordens_servico o
        where o.cliente_id = equipamentos.cliente_id and o.tecnico_id = auth.uid()
      )
    )
  )
  with check (public.pode_operacao_erp() or public.meu_papel() = 'tecnico');

-- Excluir: operação, ou o técnico removendo equipamento ainda sem OS
-- (limpeza automática quando a abertura da OS falha)
create policy equip_delete on public.equipamentos
  for delete to authenticated
  using (
    public.pode_operacao_erp()
    or (
      public.meu_papel() = 'tecnico'
      and not exists (select 1 from public.ordens_servico o where o.equipamento_id = equipamentos.id)
      and not exists (select 1 from public.os_equipamentos oe where oe.equipamento_id = equipamentos.id)
    )
  );

-- Vínculo OS ↔ equipamento: operação ou técnico responsável pela OS
drop policy if exists "Authenticated users can manage os_equipamentos" on public.os_equipamentos;
drop policy if exists os_equipamentos_autenticado on public.os_equipamentos;
drop policy if exists os_equip_all on public.os_equipamentos;

create policy os_equip_all on public.os_equipamentos
  for all to authenticated
  using (public.pode_operacao_erp() or public.os_do_tecnico(os_id))
  with check (public.pode_operacao_erp() or public.os_do_tecnico(os_id));

grant select, insert, update, delete on public.equipamentos to authenticated;
grant select, insert, update, delete on public.os_equipamentos to authenticated;
