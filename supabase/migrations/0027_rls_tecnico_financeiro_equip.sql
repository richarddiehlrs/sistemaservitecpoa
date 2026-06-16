-- Financeiro: técnico gerencia lançamentos sistema da própria OS
-- Rode APÓS 0026_rls_tecnico_atribuicao.sql

create policy lanc_select_tecnico_os on public.lancamentos_financeiros
  for select to authenticated
  using (
    public.meu_papel() = 'tecnico'
    and os_id is not null
    and public.os_do_tecnico(os_id)
  );

create policy lanc_update_tecnico_os on public.lancamentos_financeiros
  for update to authenticated
  using (
    public.meu_papel() = 'tecnico'
    and origem = 'sistema'
    and os_id is not null
    and public.os_do_tecnico(os_id)
  )
  with check (
    public.meu_papel() = 'tecnico'
    and origem = 'sistema'
    and os_id is not null
    and public.os_do_tecnico(os_id)
  );

-- Equipamentos: técnico pode cadastrar equipamento do cliente (OS de campo)
drop policy if exists equip_write on public.equipamentos;

create policy equip_insert on public.equipamentos
  for insert to authenticated
  with check (public.pode_operacao_erp() or public.meu_papel() = 'tecnico');

create policy equip_update on public.equipamentos
  for update to authenticated
  using (public.pode_operacao_erp())
  with check (public.pode_operacao_erp());

create policy equip_delete on public.equipamentos
  for delete to authenticated
  using (public.pode_operacao_erp());
