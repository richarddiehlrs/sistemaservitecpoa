-- Pagamento no check-out do técnico + preserva data_pagamento na receita
-- Rode APÓS 0031_financeiro_faturamento_visita.sql

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
  v_hoje date;
  v_incremento numeric;
  v_novo_pago numeric;
  v_devido numeric;
  v_status text;
begin
  if coalesce(p_valor, 0) <= 0 then
    return false;
  end if;

  select l.id, l.valor, l.valor_pago, l.juros, l.multa, l.forma_pagamento, l.data_pagamento
    into v_receita
  from public.lancamentos_financeiros l
  where l.os_id = p_os_id
    and l.tipo = 'receita'
    and l.status <> 'cancelado'
  limit 1;

  if not found then
    return false;
  end if;

  v_hoje := (timezone('America/Sao_Paulo', now()))::date;
  v_devido := coalesce(v_receita.valor, 0)
    + coalesce(v_receita.juros, 0)
    + coalesce(v_receita.multa, 0);
  v_incremento := least(
    round(coalesce(p_valor, 0)::numeric, 2),
    greatest(0, round(v_devido - coalesce(v_receita.valor_pago, 0), 2))
  );

  if v_incremento <= 0 then
    return true;
  end if;

  v_novo_pago := round(coalesce(v_receita.valor_pago, 0) + v_incremento, 2);

  v_status := case
    when v_novo_pago + 0.001 >= v_devido then 'pago'
    else 'parcial'
  end;

  update public.lancamentos_financeiros
    set valor_pago = v_novo_pago,
        status = v_status,
        valor_liquido = case when v_status = 'pago' then coalesce(v_receita.valor, 0) else null end,
        data_pagamento = coalesce(v_receita.data_pagamento, v_hoje),
        forma_pagamento = coalesce(nullif(trim(p_forma_pagamento), ''), v_receita.forma_pagamento),
        observacoes = coalesce(
          nullif(trim(p_observacao), ''),
          observacoes
        )
  where id = v_receita.id;

  return true;
end;
$$;

grant execute on function public.registrar_pagamento_os_checkout(uuid, numeric, text, text) to authenticated, service_role;

-- Preserva valor_pago e data_pagamento ao atualizar faturamento na conclusão
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
  select *
    into v_os
  from public.ordens_servico o
  where o.id = p_os_id;

  if not found or v_os.status = 'cancelada' then
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

  if v_valor <= 0 then
    return false;
  end if;

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

  v_obs := coalesce(
    nullif(trim(p_observacao), ''),
    case
      when v_pago > 0 then 'Serviço concluído — saldo em aberto (visita já recebida)'
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

grant execute on function public.criar_receita_os_interno(uuid, text) to authenticated, service_role;
