-- =====================================================================
-- ServitecPoa ERP - Financeiro profissional
-- Contas a pagar/receber, parcial, juros/multa, taxa de cartão,
-- parcelamento, despesas recorrentes, metas e comissão.
-- Rode no SQL Editor do Supabase APÓS 0006.
-- =====================================================================

-- ---- Lançamentos: novos campos ----
alter table public.lancamentos_financeiros
  add column if not exists valor_pago    numeric(12,2) not null default 0,
  add column if not exists juros         numeric(12,2) not null default 0,
  add column if not exists multa         numeric(12,2) not null default 0,
  add column if not exists taxa_cartao   numeric(12,2) not null default 0,
  add column if not exists valor_liquido numeric(12,2),
  add column if not exists parcela_num   integer,
  add column if not exists parcela_total integer,
  add column if not exists recorrencia_id uuid,
  add column if not exists tecnico       text;

-- status agora aceita 'parcial'
alter table public.lancamentos_financeiros
  drop constraint if exists lancamentos_financeiros_status_check;
alter table public.lancamentos_financeiros
  add constraint lancamentos_financeiros_status_check
  check (status in ('pendente','parcial','pago','cancelado'));

-- backfill para registros já existentes
update public.lancamentos_financeiros
  set valor_pago = valor
  where status = 'pago' and valor_pago = 0;
update public.lancamentos_financeiros
  set valor_liquido = valor - taxa_cartao
  where valor_liquido is null;

-- ---- Despesas fixas recorrentes ----
create table if not exists public.despesas_recorrentes (
  id             uuid primary key default gen_random_uuid(),
  descricao      text not null,
  categoria_id   uuid references public.categorias_financeiras(id) on delete set null,
  valor          numeric(12,2) not null default 0,
  dia_vencimento integer not null default 5 check (dia_vencimento between 1 and 31),
  ativo          boolean not null default true,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_recorrentes_updated_at
  before update on public.despesas_recorrentes
  for each row execute function public.set_updated_at();

-- ---- Metas de faturamento (por mês) ----
create table if not exists public.metas_faturamento (
  id         uuid primary key default gen_random_uuid(),
  ano        integer not null,
  mes        integer not null check (mes between 1 and 12),
  valor      numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ano, mes)
);

create trigger trg_metas_updated_at
  before update on public.metas_faturamento
  for each row execute function public.set_updated_at();

-- ---- Comissão padrão por técnico (% sobre o lucro) ----
alter table public.configuracoes
  add column if not exists comissao_percent numeric(5,2) not null default 0;

-- ---- RLS + grants ----
alter table public.despesas_recorrentes enable row level security;
alter table public.metas_faturamento    enable row level security;

drop policy if exists "auth all recorrentes" on public.despesas_recorrentes;
create policy "auth all recorrentes" on public.despesas_recorrentes
  for all to authenticated using (true) with check (true);

drop policy if exists "auth all metas" on public.metas_faturamento;
create policy "auth all metas" on public.metas_faturamento
  for all to authenticated using (true) with check (true);

grant all on public.despesas_recorrentes to authenticated;
grant all on public.metas_faturamento to authenticated;

-- ---- Categorias úteis de despesa (não duplica) ----
insert into public.categorias_financeiras (nome, tipo, grupo_dre)
select v.nome, 'despesa', v.grupo
from (values
  ('Aluguel', 'despesa_operacional'),
  ('Combustível', 'despesa_operacional'),
  ('Ferramentas', 'despesa_operacional'),
  ('Energia / Água / Internet', 'despesa_operacional'),
  ('Salários / Pró-labore', 'despesa_administrativa'),
  ('Taxas de cartão', 'despesa_financeira')
) as v(nome, grupo)
where not exists (
  select 1 from public.categorias_financeiras c where c.nome = v.nome
);
