-- Financeiro no check-out do técnico (serviço concluído) via RPC security definer
-- Rode APÓS 0028_portal_aprovacao_retorno.sql

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
  v_numero_fmt text;
  v_hoje date;
  v_cat_receita uuid;
  v_cat_custo uuid;
  v_receita_id uuid;
  v_pago numeric;
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

  v_valor := public.calc_valor_total_cliente_os(
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

  select l.id, l.valor_pago
    into v_receita_id, v_pago
  from public.lancamentos_financeiros l
  where l.os_id = p_os_id
    and l.tipo = 'receita'
    and l.status <> 'cancelado'
  limit 1;

  v_pago := coalesce(v_pago, 0);

  v_obs := coalesce(
    nullif(trim(p_observacao), ''),
    case
      when v_pago > 0 then 'Orçamento aprovado — saldo em aberto após abatimento da visita paga'
      else 'Gerado automaticamente na aprovação do orçamento'
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

  if v_valor is distinct from v_os.valor_total then
    update public.ordens_servico set valor_total = v_valor where id = p_os_id;
  end if;

  return true;
end;
$$;

grant execute on function public.criar_receita_os_interno(uuid, text) to authenticated, service_role;

-- Técnico: insert receita/custo sistema da própria OS (alinhado a os_do_tecnico)
drop policy if exists lanc_insert_tecnico_os on public.lancamentos_financeiros;

create policy lanc_insert_tecnico_os on public.lancamentos_financeiros
  for insert to authenticated
  with check (
    public.meu_papel() = 'tecnico'
    and origem = 'sistema'
    and os_id is not null
    and public.os_do_tecnico(os_id)
  );

-- Garante policies de leitura/atualização (idempotente)
drop policy if exists lanc_select_tecnico_os on public.lancamentos_financeiros;
drop policy if exists lanc_update_tecnico_os on public.lancamentos_financeiros;

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
