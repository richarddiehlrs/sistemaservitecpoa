-- =====================================================================
-- 0042 — Tempo real: telas atualizam sozinhas quando OS, etapas,
-- pagamentos, lançamentos ou agenda mudam (respeita as permissões RLS).
-- Rode no SQL Editor do Supabase APÓS 0041.
-- =====================================================================
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe — tempo real indisponível neste banco.';
    return;
  end if;
  foreach t in array array['ordens_servico', 'os_etapas', 'os_pagamentos', 'lancamentos_financeiros', 'agendamentos']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
