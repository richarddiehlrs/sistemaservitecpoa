-- =====================================================================
-- 0037 — Livro de pagamentos (fonte única) + contas + conciliação bancária
--
-- Ideia central:
--   * Cada recebimento/pagamento é UMA linha em public.os_pagamentos
--     (agora serve para qualquer lançamento, com ou sem OS).
--   * lancamentos_financeiros.valor_pago / status / data_pagamento /
--     valor_liquido passam a ser CALCULADOS pelo banco a partir dessas linhas.
--     Editar ou excluir um pagamento atualiza a soma automaticamente.
--   * Extratos (OFX/CSV/PDF) são importados em extrato_transacoes e
--     conciliados com os pagamentos.
--
-- Compatibilidade: código antigo que ainda grava valor_pago diretamente
-- continua funcionando — o aumento é convertido em uma linha do livro.
-- Rode no SQL Editor do Supabase APÓS 0036.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contas financeiras (banco, maquininha, caixa)
-- ---------------------------------------------------------------------
create table if not exists public.contas_financeiras (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  tipo               text not null default 'banco'
                     check (tipo in ('banco', 'maquininha', 'caixa', 'outro')),
  banco              text,
  agencia            text,
  numero             text,
  formas_padrao      text[] not null default '{}',
  saldo_inicial      numeric(12,2) not null default 0,
  data_saldo_inicial date,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column public.contas_financeiras.formas_padrao is
  'Formas de pagamento que caem nesta conta por padrão (ex.: PIX → Bradesco).';

drop trigger if exists trg_contas_fin_updated_at on public.contas_financeiras;
create trigger trg_contas_fin_updated_at
  before update on public.contas_financeiras
  for each row execute function public.set_updated_at();

insert into public.contas_financeiras (nome, tipo, banco, formas_padrao)
select 'Bradesco', 'banco', '237', array['PIX', 'Transferência', 'Boleto']
where not exists (select 1 from public.contas_financeiras where nome = 'Bradesco');

insert into public.contas_financeiras (nome, tipo, banco, formas_padrao)
select 'InfinitePay', 'maquininha', 'InfinitePay', array['Cartão de débito', 'Cartão de crédito']
where not exists (select 1 from public.contas_financeiras where nome = 'InfinitePay');

insert into public.contas_financeiras (nome, tipo, formas_padrao)
select 'Caixa (dinheiro)', 'caixa', array['Dinheiro']
where not exists (select 1 from public.contas_financeiras where nome = 'Caixa (dinheiro)');

alter table public.contas_financeiras enable row level security;

drop policy if exists contas_fin_select on public.contas_financeiras;
create policy contas_fin_select on public.contas_financeiras
  for select to authenticated using (true);

drop policy if exists contas_fin_write on public.contas_financeiras;
create policy contas_fin_write on public.contas_financeiras
  for all to authenticated
  using (public.pode_financeiro())
  with check (public.pode_financeiro());

-- ---------------------------------------------------------------------
-- 2. Extratos bancários importados
-- ---------------------------------------------------------------------
create table if not exists public.extrato_importacoes (
  id              uuid primary key default gen_random_uuid(),
  conta_id        uuid not null references public.contas_financeiras(id) on delete cascade,
  arquivo_nome    text,
  formato         text not null check (formato in ('ofx', 'csv', 'pdf', 'manual')),
  periodo_inicio  date,
  periodo_fim     date,
  saldo_final     numeric(12,2),
  qtd_transacoes  integer not null default 0,
  qtd_duplicadas  integer not null default 0,
  importado_por   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);

create table if not exists public.extrato_transacoes (
  id                 uuid primary key default gen_random_uuid(),
  conta_id           uuid not null references public.contas_financeiras(id) on delete cascade,
  importacao_id      uuid references public.extrato_importacoes(id) on delete cascade,
  data               date not null,
  valor              numeric(12,2) not null check (valor <> 0),
  descricao          text not null default '',
  documento          text,
  chave              text not null,
  status             text not null default 'pendente'
                     check (status in ('pendente', 'conciliado', 'ignorado')),
  lancamento_id      uuid references public.lancamentos_financeiros(id) on delete set null,
  taxa_ajuste        numeric(12,2) not null default 0,
  taxa_pagamento_id  uuid,
  observacao         text,
  conciliado_por     uuid references auth.users(id) on delete set null,
  conciliado_em      timestamptz,
  created_at         timestamptz not null default now(),
  unique (conta_id, chave)
);

comment on column public.extrato_transacoes.chave is
  'Identificador único no banco (FITID do OFX ou hash data|valor|descrição) — evita importar duas vezes.';
comment on column public.extrato_transacoes.lancamento_id is
  'Lançamento criado a partir desta transação (ex.: tarifa bancária).';

create index if not exists idx_extrato_tx_conta_data on public.extrato_transacoes (conta_id, data);
create index if not exists idx_extrato_tx_status on public.extrato_transacoes (status);

alter table public.extrato_importacoes enable row level security;
alter table public.extrato_transacoes enable row level security;

drop policy if exists extrato_imp_all on public.extrato_importacoes;
create policy extrato_imp_all on public.extrato_importacoes
  for all to authenticated
  using (public.pode_financeiro())
  with check (public.pode_financeiro());

drop policy if exists extrato_tx_all on public.extrato_transacoes;
create policy extrato_tx_all on public.extrato_transacoes
  for all to authenticated
  using (public.pode_financeiro())
  with check (public.pode_financeiro());

-- ---------------------------------------------------------------------
-- 3. os_pagamentos vira o LIVRO DE PAGAMENTOS de todo o financeiro
-- ---------------------------------------------------------------------
alter table public.os_pagamentos alter column os_id drop not null;

alter table public.os_pagamentos
  add column if not exists data_pagamento date,
  add column if not exists conta_id uuid references public.contas_financeiras(id) on delete set null,
  add column if not exists taxa numeric(12,2) not null default 0,
  add column if not exists extrato_transacao_id uuid,
  add column if not exists atualizado_por uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update public.os_pagamentos
  set data_pagamento = (timezone('America/Sao_Paulo', created_at))::date
  where data_pagamento is null;

alter table public.os_pagamentos
  alter column data_pagamento set default (timezone('America/Sao_Paulo', now()))::date,
  alter column data_pagamento set not null;

alter table public.os_pagamentos drop constraint if exists os_pagamentos_taxa_check;
alter table public.os_pagamentos add constraint os_pagamentos_taxa_check check (taxa >= 0);

alter table public.os_pagamentos drop constraint if exists os_pagamentos_tipo_check;
alter table public.os_pagamentos add constraint os_pagamentos_tipo_check
  check (tipo in ('visita', 'sinal', 'saldo', 'parcial', 'outro', 'baixa'));

-- Apagar a OS não pode apagar dinheiro recebido
alter table public.os_pagamentos drop constraint if exists os_pagamentos_os_id_fkey;
alter table public.os_pagamentos add constraint os_pagamentos_os_id_fkey
  foreign key (os_id) references public.ordens_servico(id) on delete set null;

alter table public.os_pagamentos drop constraint if exists os_pagamentos_lancamento_id_fkey;
alter table public.os_pagamentos add constraint os_pagamentos_lancamento_id_fkey
  foreign key (lancamento_id) references public.lancamentos_financeiros(id) on delete cascade;

alter table public.os_pagamentos drop constraint if exists os_pagamentos_extrato_tx_fkey;
alter table public.os_pagamentos add constraint os_pagamentos_extrato_tx_fkey
  foreign key (extrato_transacao_id) references public.extrato_transacoes(id) on delete set null;

create index if not exists idx_os_pagamentos_lanc on public.os_pagamentos (lancamento_id);
create index if not exists idx_os_pagamentos_data on public.os_pagamentos (data_pagamento);
create index if not exists idx_os_pagamentos_extrato on public.os_pagamentos (extrato_transacao_id);

comment on table public.os_pagamentos is
  'Livro de pagamentos: uma linha por recebimento/pagamento. Fonte da verdade de valor_pago.';

-- ---------------------------------------------------------------------
-- 4. Migração dos dados existentes (antes de ligar os triggers)
-- ---------------------------------------------------------------------
create table if not exists public.financeiro_migracao_0037_log (
  id             bigserial primary key,
  lancamento_id  uuid,
  os_id          uuid,
  valor_pago_antigo numeric(12,2),
  soma_historico numeric(12,2),
  acao           text not null,
  created_at     timestamptz not null default now()
);
alter table public.financeiro_migracao_0037_log enable row level security;
drop policy if exists fin_mig_log_select on public.financeiro_migracao_0037_log;
create policy fin_mig_log_select on public.financeiro_migracao_0037_log
  for select to authenticated using (public.pode_financeiro());

-- 4a. Vincula histórico antigo sem lancamento_id à receita ativa da OS
update public.os_pagamentos p
  set lancamento_id = l.id
from public.lancamentos_financeiros l
where p.lancamento_id is null
  and p.os_id is not null
  and l.os_id = p.os_id
  and l.tipo = 'receita'
  and l.status <> 'cancelado';

-- 4b. Remove "visita" duplicada (check-out refeito gravava duas vezes)
with dup as (
  select p.id, p.os_id, p.lancamento_id, p.valor
  from public.os_pagamentos p
  where p.tipo = 'visita'
    and exists (
      select 1 from public.os_pagamentos q
      where q.tipo = 'visita'
        and q.os_id = p.os_id
        and q.valor = p.valor
        and (q.created_at, q.id) < (p.created_at, p.id)
    )
), logged as (
  insert into public.financeiro_migracao_0037_log (lancamento_id, os_id, soma_historico, acao)
  select lancamento_id, os_id, valor, 'visita_duplicada_removida' from dup
  returning 1
)
delete from public.os_pagamentos where id in (select id from dup);

-- 4c. Alinha livro x valor_pago de cada lançamento
do $$
declare
  r record;
  p record;
  v_soma numeric;
  v_excesso numeric;
begin
  for r in
    select l.id, l.os_id, l.tipo, l.valor_pago, l.data_pagamento, l.data_competencia,
           l.forma_pagamento, l.created_at
    from public.lancamentos_financeiros l
  loop
    select coalesce(sum(valor), 0) into v_soma
    from public.os_pagamentos where lancamento_id = r.id;

    if coalesce(r.valor_pago, 0) > v_soma + 0.004 then
      -- Pagamento antigo sem histórico → cria a linha que faltava
      insert into public.os_pagamentos (
        os_id, lancamento_id, tipo, valor, data_pagamento, forma_pagamento, observacao, created_at
      ) values (
        r.os_id, r.id,
        case when r.os_id is null then 'baixa' else 'outro' end,
        round(r.valor_pago - v_soma, 2),
        coalesce(r.data_pagamento, r.data_competencia),
        r.forma_pagamento,
        'Saldo migrado (pagamento anterior ao histórico)',
        coalesce(r.created_at, now())
      );
      insert into public.financeiro_migracao_0037_log
        (lancamento_id, os_id, valor_pago_antigo, soma_historico, acao)
      values (r.id, r.os_id, r.valor_pago, v_soma, 'complemento_criado');

    elsif v_soma > coalesce(r.valor_pago, 0) + 0.004 then
      -- Histórico maior que o valor pago (bug do 0036) → corta os mais recentes
      v_excesso := round(v_soma - coalesce(r.valor_pago, 0), 2);
      insert into public.financeiro_migracao_0037_log
        (lancamento_id, os_id, valor_pago_antigo, soma_historico, acao)
      values (r.id, r.os_id, r.valor_pago, v_soma, 'historico_ajustado');

      for p in
        select id, valor from public.os_pagamentos
        where lancamento_id = r.id
        order by created_at desc, id desc
      loop
        exit when v_excesso <= 0;
        if p.valor <= v_excesso then
          delete from public.os_pagamentos where id = p.id;
          v_excesso := round(v_excesso - p.valor, 2);
        else
          update public.os_pagamentos set valor = round(valor - v_excesso, 2) where id = p.id;
          v_excesso := 0;
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

-- 4d. Conta padrão para pagamentos antigos (pela forma de pagamento)
update public.os_pagamentos p
  set conta_id = c.id
from public.contas_financeiras c
where p.conta_id is null
  and p.forma_pagamento is not null
  and p.forma_pagamento = any (c.formas_padrao)
  and c.ativo;

-- ---------------------------------------------------------------------
-- 5. Triggers do livro → lançamento
-- ---------------------------------------------------------------------

-- 5a. Lançamento: valor_pago/status/data_pagamento/valor_liquido derivados
create or replace function public.trg_lanc_derivar_pagamentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_devido numeric;
  v_pago numeric := 0;
  v_taxa numeric := 0;
  v_ultima date;
  v_delta numeric;
  v_hoje date := (timezone('America/Sao_Paulo', now()))::date;
  v_sync text := coalesce(current_setting('app.fin_sync', true), '');
begin
  v_devido := round(coalesce(new.valor, 0) + coalesce(new.juros, 0) + coalesce(new.multa, 0), 2);

  if tg_op = 'INSERT' then
    -- Inserção legada já "paga": o trigger AFTER cria a linha do livro
    v_pago := least(round(greatest(coalesce(new.valor_pago, 0), 0), 2), v_devido);
    new.valor_pago := v_pago;
    v_ultima := case when v_pago > 0 then coalesce(new.data_pagamento, v_hoje) end;
  else
    if v_sync <> 'on' then
      -- Escrita legada de valor_pago: aumento vira pagamento no livro
      v_delta := round(coalesce(new.valor_pago, 0) - coalesce(old.valor_pago, 0), 2);
      if v_delta > 0 then
        select coalesce(sum(valor), 0) into v_pago
        from public.os_pagamentos where lancamento_id = new.id;
        v_delta := least(v_delta, greatest(0, round(v_devido - v_pago, 2)));
        if v_delta > 0 then
          perform set_config('app.fin_sync', 'skip', true);
          insert into public.os_pagamentos (
            os_id, lancamento_id, tipo, valor, data_pagamento, forma_pagamento, registrado_por
          ) values (
            new.os_id, new.id,
            case
              when new.os_id is null then 'baixa'
              when v_pago + v_delta >= v_devido then 'saldo'
              else 'parcial'
            end,
            v_delta,
            coalesce(new.data_pagamento, v_hoje),
            new.forma_pagamento,
            auth.uid()
          );
          perform set_config('app.fin_sync', v_sync, true);
        end if;
      end if;
    end if;

    select coalesce(sum(valor), 0), coalesce(sum(taxa), 0), max(data_pagamento)
      into v_pago, v_taxa, v_ultima
    from public.os_pagamentos where lancamento_id = new.id;
    new.valor_pago := round(v_pago, 2);
  end if;

  new.data_pagamento := v_ultima;

  if new.status is distinct from 'cancelado' then
    new.status := case
      when new.valor_pago <= 0 then 'pendente'
      when new.valor_pago >= v_devido then 'pago'
      else 'parcial'
    end;
  end if;

  new.valor_liquido := round(v_devido - coalesce(new.taxa_cartao, 0) - v_taxa, 2);
  return new;
end;
$$;

drop trigger if exists trg_lanc_derivar_pagamentos on public.lancamentos_financeiros;
create trigger trg_lanc_derivar_pagamentos
  before insert or update on public.lancamentos_financeiros
  for each row execute function public.trg_lanc_derivar_pagamentos();

-- 5b. Inserção legada com valor_pago > 0 → cria a linha no livro
create or replace function public.trg_lanc_livro_inicial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sync text := coalesce(current_setting('app.fin_sync', true), '');
begin
  if coalesce(new.valor_pago, 0) > 0 then
    perform set_config('app.fin_sync', 'skip', true);
    insert into public.os_pagamentos (
      os_id, lancamento_id, tipo, valor, data_pagamento, forma_pagamento, observacao, registrado_por
    ) values (
      new.os_id, new.id,
      case when new.os_id is null then 'baixa' else 'saldo' end,
      new.valor_pago,
      coalesce(new.data_pagamento, (timezone('America/Sao_Paulo', now()))::date),
      new.forma_pagamento,
      'Pago no lançamento',
      auth.uid()
    );
    perform set_config('app.fin_sync', v_sync, true);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_lanc_livro_inicial on public.lancamentos_financeiros;
create trigger trg_lanc_livro_inicial
  after insert on public.lancamentos_financeiros
  for each row execute function public.trg_lanc_livro_inicial();

-- 5c. Não excluir lançamento com pagamento conciliado no banco
create or replace function public.trg_lanc_bloquear_exclusao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.os_pagamentos
    where lancamento_id = old.id and extrato_transacao_id is not null
  ) then
    raise exception 'Este lançamento tem pagamento conciliado com o extrato bancário. Desfaça a conciliação antes de excluir.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_lanc_bloquear_exclusao on public.lancamentos_financeiros;
create trigger trg_lanc_bloquear_exclusao
  before delete on public.lancamentos_financeiros
  for each row execute function public.trg_lanc_bloquear_exclusao();

-- 5d. Livro: validação antes de gravar
create or replace function public.trg_pagamento_validar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lanc record;
  v_outros numeric;
  v_devido numeric;
  v_sync text := coalesce(current_setting('app.fin_sync', true), '');
begin
  if tg_op = 'DELETE' then
    if old.extrato_transacao_id is not null then
      raise exception 'Pagamento conciliado com o extrato bancário. Desfaça a conciliação antes de excluir.';
    end if;
    return old;
  end if;

  new.valor := round(new.valor, 2);
  new.taxa := round(coalesce(new.taxa, 0), 2);
  new.data_pagamento := coalesce(new.data_pagamento, (timezone('America/Sao_Paulo', now()))::date);

  if tg_op = 'INSERT' then
    new.registrado_por := coalesce(new.registrado_por, auth.uid());
  else
    new.updated_at := now();
    new.atualizado_por := auth.uid();
    if old.extrato_transacao_id is not null
       and new.extrato_transacao_id is not distinct from old.extrato_transacao_id
       and (new.valor, new.data_pagamento, new.conta_id, new.lancamento_id)
           is distinct from (old.valor, old.data_pagamento, old.conta_id, old.lancamento_id)
    then
      raise exception 'Pagamento conciliado com o extrato bancário. Desfaça a conciliação antes de alterar.';
    end if;
  end if;

  if new.conta_id is null and new.forma_pagamento is not null then
    select c.id into new.conta_id
    from public.contas_financeiras c
    where c.ativo and new.forma_pagamento = any (c.formas_padrao)
    order by c.created_at
    limit 1;
  end if;

  if new.lancamento_id is not null then
    select l.id, l.os_id, l.status, l.valor, l.juros, l.multa
      into v_lanc
    from public.lancamentos_financeiros l
    where l.id = new.lancamento_id
    for update;

    if not found then
      raise exception 'Lançamento financeiro não encontrado.';
    end if;

    new.os_id := coalesce(v_lanc.os_id, new.os_id);

    -- Só valida saldo quando entra dinheiro novo (inserção, aumento de valor
    -- ou troca de lançamento). Editar forma/observação/data ou desvincular a
    -- OS não pode falhar mesmo que o título esteja com crédito.
    if v_sync <> 'skip' and (
      tg_op = 'INSERT'
      or new.lancamento_id is distinct from old.lancamento_id
      or new.valor > old.valor
    ) then
      if v_lanc.status = 'cancelado' then
        raise exception 'Lançamento cancelado não recebe pagamentos.';
      end if;

      select coalesce(sum(valor), 0) into v_outros
      from public.os_pagamentos
      where lancamento_id = new.lancamento_id
        and id is distinct from new.id;

      v_devido := round(coalesce(v_lanc.valor, 0) + coalesce(v_lanc.juros, 0) + coalesce(v_lanc.multa, 0), 2);
      if v_outros + new.valor > v_devido + 0.004 then
        raise exception 'Pagamento de R$ % excede o saldo em aberto de R$ %.',
          to_char(new.valor, 'FM999G999G990D00'),
          to_char(greatest(0, v_devido - v_outros), 'FM999G999G990D00');
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pagamento_validar on public.os_pagamentos;
create trigger trg_pagamento_validar
  before insert or update or delete on public.os_pagamentos
  for each row execute function public.trg_pagamento_validar();

-- 5e. Livro: depois de gravar, recalcula o(s) lançamento(s)
create or replace function public.trg_pagamento_recalcular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sync text := coalesce(current_setting('app.fin_sync', true), '');
begin
  if v_sync = 'skip' then
    return null;
  end if;

  perform set_config('app.fin_sync', 'on', true);

  if tg_op in ('INSERT', 'UPDATE') and new.lancamento_id is not null then
    update public.lancamentos_financeiros set updated_at = now() where id = new.lancamento_id;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.lancamento_id is not null
     and (tg_op = 'DELETE' or old.lancamento_id is distinct from new.lancamento_id) then
    update public.lancamentos_financeiros set updated_at = now() where id = old.lancamento_id;
  end if;

  perform set_config('app.fin_sync', v_sync, true);
  return null;
end;
$$;

drop trigger if exists trg_pagamento_recalcular on public.os_pagamentos;
create trigger trg_pagamento_recalcular
  after insert or update or delete on public.os_pagamentos
  for each row execute function public.trg_pagamento_recalcular();

-- 5f. Recalcula todos os lançamentos uma vez com a regra nova
do $$
begin
  perform set_config('app.fin_sync', 'on', true);
  update public.lancamentos_financeiros set updated_at = updated_at;
  perform set_config('app.fin_sync', '', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RLS do livro: financeiro tudo; técnico só nas OS dele, no mesmo dia
-- ---------------------------------------------------------------------
drop policy if exists os_pagamentos_select on public.os_pagamentos;
create policy os_pagamentos_select on public.os_pagamentos
  for select to authenticated
  using (
    public.pode_financeiro()
    or (os_id is not null and public.os_do_tecnico(os_id))
  );

drop policy if exists os_pagamentos_insert on public.os_pagamentos;
create policy os_pagamentos_insert on public.os_pagamentos
  for insert to authenticated
  with check (
    public.pode_financeiro()
    or (os_id is not null and public.os_do_tecnico(os_id))
  );

drop policy if exists os_pagamentos_update on public.os_pagamentos;
create policy os_pagamentos_update on public.os_pagamentos
  for update to authenticated
  using (
    public.pode_financeiro()
    or (
      os_id is not null
      and public.os_do_tecnico(os_id)
      and registrado_por = auth.uid()
      and extrato_transacao_id is null
      and (timezone('America/Sao_Paulo', created_at))::date = (timezone('America/Sao_Paulo', now()))::date
    )
  )
  with check (
    public.pode_financeiro()
    or (os_id is not null and public.os_do_tecnico(os_id) and extrato_transacao_id is null)
  );

drop policy if exists os_pagamentos_delete on public.os_pagamentos;
create policy os_pagamentos_delete on public.os_pagamentos
  for delete to authenticated
  using (
    public.pode_financeiro()
    or (
      os_id is not null
      and public.os_do_tecnico(os_id)
      and registrado_por = auth.uid()
      and extrato_transacao_id is null
      and (timezone('America/Sao_Paulo', created_at))::date = (timezone('America/Sao_Paulo', now()))::date
    )
  );

-- ---------------------------------------------------------------------
-- 7. RPCs de pagamento de OS reescritas para usar só o livro
-- ---------------------------------------------------------------------
-- Versão de 5 argumentos (0036) sai: a nova tem p_data_pagamento opcional
-- e as duas juntas deixariam a chamada ambígua.
drop function if exists public.registrar_pagamento_os_com_historico(uuid, numeric, text, text, text);

create or replace function public.registrar_pagamento_os_com_historico(
  p_os_id uuid,
  p_valor numeric,
  p_tipo text default 'parcial',
  p_forma_pagamento text default null,
  p_observacao text default null,
  p_data_pagamento date default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receita_id uuid;
  v_tipo text;
begin
  if not public.pode_alterar_financeiro_os(p_os_id) then
    return false;
  end if;
  if coalesce(p_valor, 0) <= 0 then
    return false;
  end if;

  v_tipo := coalesce(nullif(trim(p_tipo), ''), 'parcial');
  if v_tipo not in ('visita', 'sinal', 'saldo', 'parcial', 'outro') then
    v_tipo := 'parcial';
  end if;

  select l.id into v_receita_id
  from public.lancamentos_financeiros l
  where l.os_id = p_os_id
    and l.tipo = 'receita'
    and l.status <> 'cancelado'
  limit 1;

  if v_receita_id is null then
    return false;
  end if;

  insert into public.os_pagamentos (
    os_id, lancamento_id, tipo, valor, data_pagamento, forma_pagamento, observacao, registrado_por
  ) values (
    p_os_id,
    v_receita_id,
    v_tipo,
    round(p_valor, 2),
    coalesce(p_data_pagamento, (timezone('America/Sao_Paulo', now()))::date),
    nullif(trim(p_forma_pagamento), ''),
    nullif(trim(p_observacao), ''),
    auth.uid()
  );

  if nullif(trim(p_forma_pagamento), '') is not null then
    update public.lancamentos_financeiros
      set forma_pagamento = trim(p_forma_pagamento)
    where id = v_receita_id;
  end if;

  return true;
end;
$$;

grant execute on function public.registrar_pagamento_os_com_historico(uuid, numeric, text, text, text, date) to authenticated;

create or replace function public.registrar_pagamento_os_checkout(
  p_os_id uuid,
  p_valor numeric,
  p_forma_pagamento text default null,
  p_observacao text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receita record;
  v_valor numeric;
begin
  if not public.pode_alterar_financeiro_os(p_os_id) then
    return false;
  end if;

  select l.id, l.valor, l.valor_pago, l.juros, l.multa into v_receita
  from public.lancamentos_financeiros l
  where l.os_id = p_os_id and l.tipo = 'receita' and l.status <> 'cancelado'
  limit 1;
  if not found then
    return false;
  end if;

  v_valor := least(
    round(coalesce(p_valor, 0), 2),
    greatest(0, round(v_receita.valor + coalesce(v_receita.juros, 0) + coalesce(v_receita.multa, 0)
      - coalesce(v_receita.valor_pago, 0), 2))
  );
  if v_valor <= 0 then
    return true;
  end if;

  return public.registrar_pagamento_os_com_historico(
    p_os_id, v_valor, 'saldo', p_forma_pagamento, p_observacao, null::date
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Conciliação bancária (RPCs atômicas)
-- ---------------------------------------------------------------------
create or replace function public.conciliar_transacao(
  p_transacao_id uuid,
  p_pagamento_ids uuid[],
  p_diferenca_como_taxa boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_soma numeric;
  v_qtd integer;
  v_tipo_errado integer;
  v_dif numeric;
  v_ultimo uuid;
begin
  if not public.pode_financeiro() then
    raise exception 'Sem permissão para conciliar.';
  end if;

  select * into v_tx from public.extrato_transacoes where id = p_transacao_id for update;
  if not found then
    raise exception 'Transação do extrato não encontrada.';
  end if;
  if v_tx.status <> 'pendente' then
    raise exception 'Esta transação já foi conciliada ou ignorada.';
  end if;
  if coalesce(array_length(p_pagamento_ids, 1), 0) = 0 then
    raise exception 'Selecione ao menos um pagamento do sistema.';
  end if;

  select count(*), coalesce(sum(p.valor), 0),
         count(*) filter (
           where (v_tx.valor > 0 and l.tipo <> 'receita') or (v_tx.valor < 0 and l.tipo <> 'despesa')
         )
    into v_qtd, v_soma, v_tipo_errado
  from public.os_pagamentos p
  join public.lancamentos_financeiros l on l.id = p.lancamento_id
  where p.id = any (p_pagamento_ids)
    and p.extrato_transacao_id is null;

  if v_qtd <> array_length(p_pagamento_ids, 1) then
    raise exception 'Algum pagamento selecionado já foi conciliado ou não existe.';
  end if;
  if v_tipo_errado > 0 then
    raise exception 'Entrada no banco só concilia com receitas; saída só com despesas.';
  end if;

  -- v_dif > 0: sistema registrou mais do que caiu no banco (ex.: taxa da maquininha)
  v_dif := round(v_soma - abs(v_tx.valor), 2);

  if abs(v_dif) > 0.004 then
    if not p_diferenca_como_taxa or v_dif < 0 or v_tx.valor < 0 then
      raise exception 'Diferença de R$ % entre o banco (R$ %) e os pagamentos selecionados (R$ %).',
        to_char(abs(v_dif), 'FM999G999G990D00'),
        to_char(abs(v_tx.valor), 'FM999G999G990D00'),
        to_char(v_soma, 'FM999G999G990D00');
    end if;

    select p.id into v_ultimo
    from public.os_pagamentos p
    where p.id = any (p_pagamento_ids)
    order by p.valor desc, p.id
    limit 1;

    update public.os_pagamentos set taxa = taxa + v_dif where id = v_ultimo;
  end if;

  update public.os_pagamentos
    set extrato_transacao_id = p_transacao_id,
        conta_id = v_tx.conta_id
  where id = any (p_pagamento_ids);

  update public.extrato_transacoes
    set status = 'conciliado',
        taxa_ajuste = case when abs(v_dif) > 0.004 then v_dif else 0 end,
        taxa_pagamento_id = case when abs(v_dif) > 0.004 then v_ultimo else null end,
        conciliado_por = auth.uid(),
        conciliado_em = now()
  where id = p_transacao_id;
end;
$$;

create or replace function public.desconciliar_transacao(p_transacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
begin
  if not public.pode_financeiro() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_tx from public.extrato_transacoes where id = p_transacao_id for update;
  if not found then
    raise exception 'Transação não encontrada.';
  end if;

  if v_tx.taxa_pagamento_id is not null and v_tx.taxa_ajuste <> 0 then
    update public.os_pagamentos
      set taxa = greatest(0, taxa - v_tx.taxa_ajuste)
    where id = v_tx.taxa_pagamento_id;
  end if;

  update public.os_pagamentos
    set extrato_transacao_id = null
  where extrato_transacao_id = p_transacao_id;

  -- Lançamento criado a partir do extrato (ex.: tarifa) → remove junto
  if v_tx.lancamento_id is not null then
    delete from public.os_pagamentos where lancamento_id = v_tx.lancamento_id;
    update public.lancamentos_financeiros set status = 'cancelado' where id = v_tx.lancamento_id;
  end if;

  update public.extrato_transacoes
    set status = 'pendente',
        lancamento_id = null,
        taxa_ajuste = 0,
        taxa_pagamento_id = null,
        conciliado_por = null,
        conciliado_em = null
  where id = p_transacao_id;
end;
$$;

-- Cria lançamento + pagamento a partir de uma linha do extrato (tarifa, recebimento avulso…)
create or replace function public.criar_lancamento_de_transacao(
  p_transacao_id uuid,
  p_descricao text,
  p_categoria_id uuid default null,
  p_cliente_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_lanc_id uuid;
  v_conta record;
begin
  if not public.pode_financeiro() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_tx from public.extrato_transacoes where id = p_transacao_id for update;
  if not found then
    raise exception 'Transação não encontrada.';
  end if;
  if v_tx.status <> 'pendente' then
    raise exception 'Esta transação já foi conciliada ou ignorada.';
  end if;

  select nome into v_conta from public.contas_financeiras where id = v_tx.conta_id;

  insert into public.lancamentos_financeiros (
    tipo, descricao, categoria_id, cliente_id, valor, valor_pago,
    data_competencia, data_vencimento, status, origem, observacoes
  ) values (
    case when v_tx.valor > 0 then 'receita' else 'despesa' end,
    coalesce(nullif(trim(p_descricao), ''), v_tx.descricao, 'Lançamento do extrato'),
    p_categoria_id,
    p_cliente_id,
    abs(v_tx.valor),
    0,
    v_tx.data,
    v_tx.data,
    'pendente',
    'sistema',
    'Criado pela conciliação — ' || coalesce(v_conta.nome, 'conta') || ': ' || v_tx.descricao
  )
  returning id into v_lanc_id;

  insert into public.os_pagamentos (
    lancamento_id, tipo, valor, data_pagamento, conta_id, observacao, extrato_transacao_id, registrado_por
  ) values (
    v_lanc_id, 'baixa', abs(v_tx.valor), v_tx.data, v_tx.conta_id,
    'Conciliado com extrato', p_transacao_id, auth.uid()
  );

  update public.extrato_transacoes
    set status = 'conciliado',
        lancamento_id = v_lanc_id,
        conciliado_por = auth.uid(),
        conciliado_em = now()
  where id = p_transacao_id;

  return v_lanc_id;
end;
$$;

grant execute on function public.conciliar_transacao(uuid, uuid[], boolean) to authenticated;
grant execute on function public.desconciliar_transacao(uuid) to authenticated;
grant execute on function public.criar_lancamento_de_transacao(uuid, text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Despesa fixa não pode ser gerada duas vezes no mesmo mês
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.lancamentos_financeiros
    where recorrencia_id is not null and status <> 'cancelado'
    group by recorrencia_id, date_trunc('month', data_competencia)
    having count(*) > 1
  ) then
    raise notice 'Há despesas fixas duplicadas no mesmo mês — cancele as repetidas e crie o índice idx_lanc_recorrencia_mes manualmente.';
  else
    create unique index if not exists idx_lanc_recorrencia_mes
      on public.lancamentos_financeiros (recorrencia_id, data_competencia)
      where recorrencia_id is not null and status <> 'cancelado';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Fluxo de caixa pela data de CADA pagamento (não a última)
-- ---------------------------------------------------------------------
create or replace view public.vw_fluxo_caixa as
select
  date_trunc('month', p.data_pagamento)::date as mes,
  l.tipo,
  sum(p.valor) as total
from public.os_pagamentos p
join public.lancamentos_financeiros l on l.id = p.lancamento_id
group by 1, 2;
