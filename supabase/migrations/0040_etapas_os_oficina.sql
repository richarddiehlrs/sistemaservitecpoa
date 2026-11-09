-- =====================================================================
-- 0040 — Linha do tempo da OS (etapas) e local do aparelho
--  * os_etapas: marcos do atendimento (coletado, peça pedida, reparo
--    iniciado, pronto…) com data/hora, quem registrou e observação
--  * ordens_servico.local_equipamento: cliente | oficina | transito | entregue
--    (coletado em visita vai para o painel da oficina sem mudar o tipo da OS)
--  * os_publica_etapas(token): linha do tempo para o portal do cliente
-- Rode no SQL Editor do Supabase APÓS 0039.
-- =====================================================================

alter table public.ordens_servico
  add column if not exists local_equipamento text not null default 'cliente',
  add column if not exists etapa_atual text,
  add column if not exists etapa_em timestamptz;

alter table public.ordens_servico drop constraint if exists ordens_servico_local_equipamento_check;
alter table public.ordens_servico add constraint ordens_servico_local_equipamento_check
  check (local_equipamento in ('cliente', 'oficina', 'transito', 'entregue'));

-- OS de oficina ainda em andamento: aparelho está na oficina
update public.ordens_servico
  set local_equipamento = 'oficina'
where tipo_atendimento = 'oficina'
  and status not in ('entregue', 'cancelada')
  and local_equipamento = 'cliente';

update public.ordens_servico
  set local_equipamento = 'entregue'
where status = 'entregue' and local_equipamento = 'cliente' and tipo_atendimento = 'oficina';

create index if not exists idx_os_local_equipamento on public.ordens_servico (local_equipamento)
  where local_equipamento in ('oficina', 'transito');

create table if not exists public.os_etapas (
  id             uuid primary key default gen_random_uuid(),
  os_id          uuid not null references public.ordens_servico(id) on delete cascade,
  etapa          text not null check (etapa in (
                   'coletado_oficina', 'recebido_oficina', 'diagnostico', 'peca_solicitada',
                   'peca_recebida', 'reparo_iniciado', 'testes', 'pronto', 'saiu_entrega', 'entregue'
                 )),
  observacao     text,
  previsao       date,
  registrado_por uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);

create index if not exists idx_os_etapas_os on public.os_etapas (os_id, created_at);

alter table public.os_etapas enable row level security;

drop policy if exists os_etapas_select on public.os_etapas;
create policy os_etapas_select on public.os_etapas
  for select to authenticated
  using (public.pode_operacao_erp() or public.os_do_tecnico(os_id));

drop policy if exists os_etapas_insert on public.os_etapas;
create policy os_etapas_insert on public.os_etapas
  for insert to authenticated
  with check (public.pode_operacao_erp() or public.os_do_tecnico(os_id));

drop policy if exists os_etapas_delete on public.os_etapas;
create policy os_etapas_delete on public.os_etapas
  for delete to authenticated
  using (public.pode_operacao_erp());

grant select, insert, delete on public.os_etapas to authenticated;

-- Portal do cliente: linha do tempo pelo token da OS (sem dados internos)
create or replace function public.os_publica_etapas(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
    'etapa', e.etapa,
    'observacao', e.observacao,
    'previsao', e.previsao,
    'created_at', e.created_at
  ) order by e.created_at), '[]'::json)
  from public.os_etapas e
  join public.ordens_servico o on o.id = e.os_id
  where o.aprovacao_token = p_token
    and o.status <> 'cancelada';
$$;

grant execute on function public.os_publica_etapas(uuid) to anon, authenticated;
