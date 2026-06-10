-- =====================================================================
-- ServitecPoa ERP - Schema inicial
-- Banco: PostgreSQL (Supabase)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Função utilitária: atualizar coluna updated_at automaticamente
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- CLIENTES
-- =====================================================================
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null default 'PF' check (tipo in ('PF','PJ')),
  nome          text not null,
  cpf_cnpj      text,
  rg_ie         text,
  telefone      text,
  telefone2     text,
  email         text,
  cep           text,
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  cidade        text,
  uf            text,
  ponto_referencia text,
  observacoes   text,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_clientes_nome on public.clientes (lower(nome));
create index if not exists idx_clientes_cpf_cnpj on public.clientes (cpf_cnpj);
create index if not exists idx_clientes_telefone on public.clientes (telefone);

create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- =====================================================================
-- EQUIPAMENTOS (eletrodomésticos do cliente) - histórico por produto
-- =====================================================================
create table if not exists public.equipamentos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  tipo          text not null,                 -- ex: Geladeira, Fogão, Máquina de Lavar
  marca         text,
  modelo        text,
  numero_serie  text,
  cor           text,
  voltagem      text,                          -- 110V / 220V / Bivolt
  acessorios    text,                          -- itens que acompanham
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_equipamentos_cliente on public.equipamentos (cliente_id);

create trigger trg_equipamentos_updated_at
  before update on public.equipamentos
  for each row execute function public.set_updated_at();

-- =====================================================================
-- ORDENS DE SERVIÇO
-- =====================================================================
create sequence if not exists public.os_numero_seq start with 1;

create table if not exists public.ordens_servico (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint not null default nextval('public.os_numero_seq') unique,
  cliente_id        uuid not null references public.clientes(id) on delete restrict,
  equipamento_id    uuid references public.equipamentos(id) on delete set null,

  status            text not null default 'aberta'
                    check (status in ('aberta','em_analise','aguardando_aprovacao',
                                      'aprovada','em_execucao','aguardando_peca',
                                      'concluida','entregue','cancelada','garantia')),

  -- Diagnóstico técnico
  defeito_relatado  text,            -- relatado pelo cliente
  diagnostico       text,            -- laudo técnico
  servico_executado text,            -- o que foi feito
  acompanha         text,            -- o que veio junto com o equipamento
  estado_aparelho   text,            -- avarias estéticas / observações de entrada

  tecnico           text,
  prioridade        text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),

  -- Datas
  data_abertura     timestamptz not null default now(),
  data_previsao     date,
  data_conclusao    timestamptz,
  data_entrega      timestamptz,

  -- Valores
  valor_visita      numeric(12,2) not null default 0,   -- taxa de visita técnica cobrada
  abater_visita     boolean not null default true,      -- abate a visita do total ao aprovar serviço
  desconto          numeric(12,2) not null default 0,
  acrescimo         numeric(12,2) not null default 0,

  -- Totais (mantidos pela aplicação / recalculados)
  valor_itens       numeric(12,2) not null default 0,   -- soma dos itens
  valor_total       numeric(12,2) not null default 0,   -- total a pagar pelo cliente

  forma_pagamento   text,
  garantia_dias     integer not null default 90,
  observacoes       text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_os_cliente on public.ordens_servico (cliente_id);
create index if not exists idx_os_status on public.ordens_servico (status);
create index if not exists idx_os_data_abertura on public.ordens_servico (data_abertura);

create trigger trg_os_updated_at
  before update on public.ordens_servico
  for each row execute function public.set_updated_at();

-- =====================================================================
-- ITENS DA OS (serviços e peças)
-- =====================================================================
create table if not exists public.os_itens (
  id              uuid primary key default gen_random_uuid(),
  os_id           uuid not null references public.ordens_servico(id) on delete cascade,
  tipo            text not null default 'servico' check (tipo in ('servico','peca')),
  descricao       text not null,
  quantidade      numeric(12,2) not null default 1,
  valor_unitario  numeric(12,2) not null default 0,
  subtotal        numeric(12,2) generated always as (quantidade * valor_unitario) stored,
  created_at      timestamptz not null default now()
);

create index if not exists idx_os_itens_os on public.os_itens (os_id);

-- =====================================================================
-- HISTÓRICO DE STATUS DA OS
-- =====================================================================
create table if not exists public.os_status_historico (
  id          uuid primary key default gen_random_uuid(),
  os_id       uuid not null references public.ordens_servico(id) on delete cascade,
  status      text not null,
  observacao  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_os_hist_os on public.os_status_historico (os_id);

-- =====================================================================
-- FINANCEIRO
-- =====================================================================
create table if not exists public.categorias_financeiras (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tipo        text not null check (tipo in ('receita','despesa')),
  grupo_dre   text not null default 'operacional'
              check (grupo_dre in ('receita_servico','receita_pecas','outras_receitas',
                                   'custo_pecas','custo_servico','despesa_operacional',
                                   'despesa_administrativa','despesa_financeira','impostos')),
  created_at  timestamptz not null default now()
);

create table if not exists public.lancamentos_financeiros (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('receita','despesa')),
  descricao       text not null,
  categoria_id    uuid references public.categorias_financeiras(id) on delete set null,
  os_id           uuid references public.ordens_servico(id) on delete set null,
  cliente_id      uuid references public.clientes(id) on delete set null,
  valor           numeric(12,2) not null check (valor >= 0),
  data_competencia date not null default current_date,  -- regime de competência (DRE)
  data_vencimento date,
  data_pagamento  date,                                 -- regime de caixa (fluxo)
  status          text not null default 'pendente'
                  check (status in ('pendente','pago','cancelado')),
  forma_pagamento text,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_lanc_tipo on public.lancamentos_financeiros (tipo);
create index if not exists idx_lanc_status on public.lancamentos_financeiros (status);
create index if not exists idx_lanc_competencia on public.lancamentos_financeiros (data_competencia);
create index if not exists idx_lanc_pagamento on public.lancamentos_financeiros (data_pagamento);
create index if not exists idx_lanc_os on public.lancamentos_financeiros (os_id);

create trigger trg_lanc_updated_at
  before update on public.lancamentos_financeiros
  for each row execute function public.set_updated_at();

-- =====================================================================
-- VIEWS - DRE e Fluxo de Caixa
-- =====================================================================

-- DRE por mês (regime de competência) - somente lançamentos não cancelados
create or replace view public.vw_dre as
select
  date_trunc('month', l.data_competencia)::date as mes,
  c.grupo_dre,
  l.tipo,
  sum(l.valor) as total
from public.lancamentos_financeiros l
left join public.categorias_financeiras c on c.id = l.categoria_id
where l.status <> 'cancelado'
group by 1, 2, 3;

-- Fluxo de caixa realizado por mês (regime de caixa) - apenas pagos
create or replace view public.vw_fluxo_caixa as
select
  date_trunc('month', l.data_pagamento)::date as mes,
  l.tipo,
  sum(l.valor) as total
from public.lancamentos_financeiros l
where l.status = 'pago' and l.data_pagamento is not null
group by 1, 2;

-- =====================================================================
-- RLS (Row Level Security) - ERP interno single-tenant
-- Usuários autenticados têm acesso total. Anônimos: sem acesso.
-- =====================================================================
alter table public.clientes              enable row level security;
alter table public.equipamentos          enable row level security;
alter table public.ordens_servico        enable row level security;
alter table public.os_itens              enable row level security;
alter table public.os_status_historico   enable row level security;
alter table public.categorias_financeiras enable row level security;
alter table public.lancamentos_financeiros enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'clientes','equipamentos','ordens_servico','os_itens',
    'os_status_historico','categorias_financeiras','lancamentos_financeiros'
  ]
  loop
    execute format('drop policy if exists "auth_all_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "auth_all_%1$s" on public.%1$s
         for all to authenticated using (true) with check (true);', t);
  end loop;
end$$;

-- =====================================================================
-- PRIVILÉGIOS (Data API / PostgREST)
-- Garante que o papel "authenticated" acesse as tabelas (RLS continua
-- restringindo o conteúdo). O papel "anon" não recebe acesso.
-- =====================================================================
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.clientes,
  public.equipamentos,
  public.ordens_servico,
  public.os_itens,
  public.os_status_historico,
  public.categorias_financeiras,
  public.lancamentos_financeiros
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant select on public.vw_dre, public.vw_fluxo_caixa to authenticated;

-- =====================================================================
-- SEED - categorias financeiras padrão
-- =====================================================================
insert into public.categorias_financeiras (nome, tipo, grupo_dre) values
  ('Serviços de assistência técnica', 'receita', 'receita_servico'),
  ('Venda de peças', 'receita', 'receita_pecas'),
  ('Visita técnica', 'receita', 'receita_servico'),
  ('Outras receitas', 'receita', 'outras_receitas'),
  ('Compra de peças', 'despesa', 'custo_pecas'),
  ('Terceirização de serviço', 'despesa', 'custo_servico'),
  ('Combustível / deslocamento', 'despesa', 'despesa_operacional'),
  ('Aluguel', 'despesa', 'despesa_administrativa'),
  ('Energia / água / internet', 'despesa', 'despesa_administrativa'),
  ('Salários / pró-labore', 'despesa', 'despesa_administrativa'),
  ('Ferramentas / equipamentos', 'despesa', 'despesa_operacional'),
  ('Taxas de cartão / banco', 'despesa', 'despesa_financeira'),
  ('Impostos (Simples Nacional)', 'despesa', 'impostos')
on conflict do nothing;
