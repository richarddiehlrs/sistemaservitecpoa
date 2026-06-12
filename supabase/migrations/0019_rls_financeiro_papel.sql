-- RLS financeiro por papel: técnico não altera lançamentos gerais; despesa de campo permitida
-- Rode no SQL Editor do Supabase APÓS 0018.

create or replace function public.meu_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.papel from public.profiles p where p.id = auth.uid()), '');
$$;

create or replace function public.pode_financeiro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.meu_papel() in ('admin', 'atendente');
$$;

-- ---- lancamentos_financeiros ----
drop policy if exists "auth_all_lancamentos_financeiros" on public.lancamentos_financeiros;

create policy lanc_select on public.lancamentos_financeiros
  for select to authenticated
  using (
    public.pode_financeiro()
    or (origem = 'campo' and criado_por = auth.uid())
  );

create policy lanc_insert on public.lancamentos_financeiros
  for insert to authenticated
  with check (
    public.pode_financeiro()
    or (
      public.meu_papel() = 'tecnico'
      and origem = 'campo'
      and tipo = 'despesa'
      and criado_por = auth.uid()
    )
  );

create policy lanc_update on public.lancamentos_financeiros
  for update to authenticated
  using (public.pode_financeiro())
  with check (public.pode_financeiro());

create policy lanc_delete on public.lancamentos_financeiros
  for delete to authenticated
  using (public.pode_financeiro());

-- ---- categorias_financeiras ----
drop policy if exists "auth_all_categorias_financeiras" on public.categorias_financeiras;

create policy cat_select on public.categorias_financeiras
  for select to authenticated using (true);

create policy cat_insert on public.categorias_financeiras
  for insert to authenticated with check (public.pode_financeiro());

create policy cat_update on public.categorias_financeiras
  for update to authenticated
  using (public.pode_financeiro()) with check (public.pode_financeiro());

create policy cat_delete on public.categorias_financeiras
  for delete to authenticated using (public.pode_financeiro());

-- ---- despesas_recorrentes e metas ----
drop policy if exists "auth all recorrentes" on public.despesas_recorrentes;
create policy recorrentes_fin on public.despesas_recorrentes
  for all to authenticated
  using (public.pode_financeiro()) with check (public.pode_financeiro());

drop policy if exists "auth all metas" on public.metas_faturamento;
create policy metas_fin on public.metas_faturamento
  for all to authenticated
  using (public.pode_financeiro()) with check (public.pode_financeiro());
