-- Pagamentos parciais integrados (visita, sinal, saldo) + config sinal + correção visita-only

alter table public.configuracoes
  add column if not exists percentual_sinal_padrao numeric(5,2) not null default 50
    check (percentual_sinal_padrao >= 0 and percentual_sinal_padrao <= 100);

comment on column public.configuracoes.percentual_sinal_padrao is
  'Percentual sugerido de entrada/sinal após aprovação do orçamento (ex.: 30, 50).';

-- Histórico de pagamentos por OS (visita, sinal, saldo, parcial)
create table if not exists public.os_pagamentos (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.ordens_servico(id) on delete cascade,
  lancamento_id uuid references public.lancamentos_financeiros(id) on delete set null,
  tipo text not null check (tipo in ('visita', 'sinal', 'saldo', 'parcial', 'outro')),
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text,
  observacao text,
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_os_pagamentos_os on public.os_pagamentos(os_id, created_at desc);

alter table public.os_pagamentos enable row level security;

drop policy if exists os_pagamentos_select on public.os_pagamentos;
create policy os_pagamentos_select on public.os_pagamentos
  for select to authenticated
  using (
    public.pode_operacao_erp()
    or public.os_do_tecnico(os_id)
  );

drop policy if exists os_pagamentos_insert on public.os_pagamentos;
create policy os_pagamentos_insert on public.os_pagamentos
  for insert to authenticated
  with check (
    public.pode_operacao_erp()
    or public.os_do_tecnico(os_id)
  );

-- Conclusão com visita já paga e faturamento zero (só visita técnica)
create or replace function public.criar_receita_os_interno(
  p_os_id uuid,
  p_observacao text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_os record;
  v_valor numeric;
  v_saldo_cliente numeric;
  v_numero_fmt text;
  v_hoje date;
  v_cat_receita uuid;
  v_cat_custo uuid;
  v_receita_id uuid;
  v_pago numeric;
  v_data_pagamento date;
  v_status text;
  v_obs text;
begin
  if not public.pode_alterar_financeiro_os(p_os_id) then
    return false;
  end if;

  select *
    into v_os
  from public.ordens_servico o
  where o.id = p_os_id;

  if not found or v_os.status = 'cancelada' then
    return false;
  end if;

  if v_os.motivo_atendimento = 'retorno_garantia' then
    return false;
  end if;

  v_valor := public.calc_receita_faturamento_os(
    v_os.valor_itens,
    v_os.valor_visita,
    v_os.abater_visita,
    v_os.desconto,
    v_os.acrescimo
  );

  v_saldo_cliente := public.calc_valor_total_cliente_os(
    v_os.valor_itens,
    v_os.valor_visita,
    v_os.abater_visita,
    v_os.desconto,
    v_os.acrescimo
  );

  v_hoje := (timezone('America/Sao_Paulo', now()))::date;
  v_numero_fmt := 'OS-' || lpad(v_os.numero::text, 5, '0');

  select id into v_cat_receita
  from public.categorias_financeiras
  where nome = 'Serviços de assistência técnica'
  limit 1;

  select id into v_cat_custo
  from public.categorias_financeiras
  where nome = 'Compra de peças'
  limit 1;

  select l.id, l.valor_pago, l.data_pagamento
    into v_receita_id, v_pago, v_data_pagamento
  from public.lancamentos_financeiros l
  where l.os_id = p_os_id
    and l.tipo = 'receita'
    and l.status <> 'cancelado'
  limit 1;

  v_pago := coalesce(v_pago, 0);

  -- Visita-only: receita já quitada, faturamento nominal zero — permite concluir
  if v_valor <= 0 then
    if v_receita_id is not null and v_pago > 0 then
      if v_saldo_cliente is distinct from v_os.valor_total then
        update public.ordens_servico set valor_total = v_saldo_cliente where id = p_os_id;
      end if;
      return true;
    end if;
    return false;
  end if;

  v_obs := coalesce(
    nullif(trim(p_observacao), ''),
    case
      when v_pago > 0 then 'Serviço concluído — saldo em aberto (pagamentos parciais recebidos)'
      else 'Gerado automaticamente na conclusão do serviço'
    end
  );

  if v_receita_id is not null then
    if v_pago > 0 and v_valor + 0.001 < v_pago then
      return false;
    end if;

    v_status := case
      when v_pago <= 0 then 'pendente'
      when v_pago + 0.001 >= v_valor then 'pago'
      else 'parcial'
    end;

    update public.lancamentos_financeiros
      set valor = v_valor,
          status = v_status,
          valor_liquido = case when v_status = 'pago' then v_valor else null end,
          data_pagamento = case when v_pago > 0 then coalesce(v_data_pagamento, v_hoje) else data_pagamento end,
          observacoes = v_obs
    where id = v_receita_id;
  else
    insert into public.lancamentos_financeiros (
      tipo, descricao, categoria_id, os_id, cliente_id,
      valor, valor_pago, data_competencia, data_vencimento,
      status, origem, forma_pagamento, observacoes
    ) values (
      'receita',
      'Receita ' || v_numero_fmt,
      v_cat_receita,
      v_os.id,
      v_os.cliente_id,
      v_valor,
      0,
      v_hoje,
      v_hoje,
      'pendente',
      'sistema',
      v_os.forma_pagamento,
      v_obs
    );
  end if;

  if coalesce(v_os.custo_total, 0) > 0 then
    if not exists (
      select 1 from public.lancamentos_financeiros l
      where l.os_id = p_os_id
        and l.tipo = 'despesa'
        and l.descricao like 'Custo OS-%'
        and l.status <> 'cancelado'
    ) then
      insert into public.lancamentos_financeiros (
        tipo, descricao, categoria_id, os_id, cliente_id,
        valor, valor_pago, data_competencia, data_vencimento,
        status, origem, observacoes
      ) values (
        'despesa',
        'Custo ' || v_numero_fmt,
        v_cat_custo,
        v_os.id,
        v_os.cliente_id,
        v_os.custo_total,
        0,
        v_hoje,
        v_hoje,
        'pendente',
        'sistema',
        'Custo de peças — pagar ao fornecedor separadamente'
      );
    end if;
  end if;

  if v_saldo_cliente is distinct from v_os.valor_total then
    update public.ordens_servico set valor_total = v_saldo_cliente where id = p_os_id;
  end if;

  return true;
end;
$$;

-- Registra pagamento na receita + histórico os_pagamentos
create or replace function public.registrar_pagamento_os_com_historico(
  p_os_id uuid,
  p_valor numeric,
  p_tipo text default 'parcial',
  p_forma_pagamento text default null,
  p_observacao text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_receita_id uuid;
  v_incremento numeric;
  v_receita record;
  v_devido numeric;
  v_tipo text;
begin
  v_tipo := coalesce(nullif(trim(p_tipo), ''), 'parcial');
  if v_tipo not in ('visita', 'sinal', 'saldo', 'parcial', 'outro') then
    v_tipo := 'parcial';
  end if;

  v_ok := public.registrar_pagamento_os_checkout(
    p_os_id,
    p_valor,
    p_forma_pagamento,
    p_observacao
  );

  if not v_ok then
    return false;
  end if;

  select l.id, l.valor, l.valor_pago, l.juros, l.multa
    into v_receita
  from public.lancamentos_financeiros l
  where l.os_id = p_os_id
    and l.tipo = 'receita'
    and l.status <> 'cancelado'
  limit 1;

  if not found then
    return true;
  end if;

  v_devido := coalesce(v_receita.valor, 0)
    + coalesce(v_receita.juros, 0)
    + coalesce(v_receita.multa, 0);

  v_incremento := least(
    round(coalesce(p_valor, 0)::numeric, 2),
    round(coalesce(v_receita.valor_pago, 0), 2)
  );

  -- Valor efetivamente registrado nesta operação (aproximação segura)
  select round(coalesce(p_valor, 0)::numeric, 2) into v_incremento;
  if v_incremento <= 0 then
    return true;
  end if;

  insert into public.os_pagamentos (
    os_id, lancamento_id, tipo, valor, forma_pagamento, observacao, registrado_por
  ) values (
    p_os_id,
    v_receita.id,
    v_tipo,
    v_incremento,
    nullif(trim(p_forma_pagamento), ''),
    nullif(trim(p_observacao), ''),
    auth.uid()
  );

  return true;
end;
$$;

grant execute on function public.registrar_pagamento_os_com_historico(uuid, numeric, text, text, text) to authenticated;
