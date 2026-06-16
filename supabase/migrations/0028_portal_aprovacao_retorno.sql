-- Portal: aprovação via RPC (security definer) + helpers financeiros
-- Rode APÓS 0027_rls_tecnico_financeiro_equip.sql

create or replace function public.calc_valor_total_cliente_os(
  p_valor_itens numeric,
  p_valor_visita numeric,
  p_abater_visita boolean,
  p_desconto numeric,
  p_acrescimo numeric
)
returns numeric
language sql
immutable
as $$
  select greatest(
    0,
    round(
      (
        case
          when p_abater_visita then
            coalesce(p_valor_itens, 0) + coalesce(p_acrescimo, 0) - coalesce(p_desconto, 0)
            - coalesce(p_valor_visita, 0)
          else
            coalesce(p_valor_itens, 0) + coalesce(p_acrescimo, 0) - coalesce(p_desconto, 0)
            + coalesce(p_valor_visita, 0)
        end
      )::numeric,
      2
    )
  );
$$;

create or replace function public.criar_receita_os_interno(p_os_id uuid)
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
          observacoes = case
            when v_pago > 0 then 'Orçamento aprovado — saldo em aberto após abatimento da visita paga'
            else 'Gerado automaticamente na aprovação do orçamento'
          end
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
      'Gerado automaticamente na aprovação do orçamento'
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

create or replace function public.portal_aprovar_orcamento(
  p_token uuid,
  p_assinatura text default null,
  p_obs text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_os record;
  v_valor numeric;
  v_novo_status text;
  v_finance_ok boolean;
begin
  select o.*, c.nome as cliente_nome
    into v_os
  from public.ordens_servico o
  join public.clientes c on c.id = o.cliente_id
  where o.aprovacao_token = p_token;

  if not found then
    return json_build_object('ok', false, 'erro', 'OS não encontrada.');
  end if;

  if v_os.status = 'cancelada' then
    return json_build_object('ok', false, 'erro', 'Esta ordem foi cancelada.');
  end if;

  if v_os.status = 'cliente_ausente' then
    return json_build_object('ok', false, 'erro', 'Não é possível aprovar enquanto o cliente estiver ausente.');
  end if;

  v_valor := public.calc_valor_total_cliente_os(
    v_os.valor_itens,
    v_os.valor_visita,
    v_os.abater_visita,
    v_os.desconto,
    v_os.acrescimo
  );

  if v_os.aprovado then
    perform public.criar_receita_os_interno(v_os.id);
    return json_build_object('ok', true, 'ja_aprovada', true, 'os_id', v_os.id);
  end if;

  if v_valor <= 0 then
    return json_build_object('ok', false, 'erro', 'Informe os valores (serviços/peças ou visita) antes de aprovar.');
  end if;

  if v_os.status not in ('aberta', 'em_analise', 'aguardando_aprovacao') then
    return json_build_object('ok', false, 'erro', 'Orçamento não disponível para aprovação neste momento.');
  end if;

  v_novo_status := 'aprovada';

  update public.ordens_servico
    set aprovado = true,
        data_aprovacao = now(),
        assinatura_cliente = coalesce(p_assinatura, assinatura_cliente),
        observacao_aprovacao = p_obs,
        status = v_novo_status,
        valor_aprovado = v_valor,
        valor_total = v_valor
  where id = v_os.id
    and aprovado = false;

  if not found then
    perform public.criar_receita_os_interno(v_os.id);
    return json_build_object('ok', true, 'ja_aprovada', true, 'os_id', v_os.id);
  end if;

  insert into public.os_status_historico (os_id, status, observacao)
  values (v_os.id, v_novo_status, 'Orçamento aprovado (portal do cliente)');

  v_finance_ok := public.criar_receita_os_interno(v_os.id);

  if not v_finance_ok then
    update public.ordens_servico
      set aprovado = false,
          data_aprovacao = null,
          valor_aprovado = null,
          observacao_aprovacao = null,
          status = v_os.status,
          valor_total = v_os.valor_total,
          assinatura_cliente = case when p_assinatura is not null then null else assinatura_cliente end
    where id = v_os.id;

    insert into public.os_status_historico (os_id, status, observacao)
    values (v_os.id, v_os.status, 'Aprovação revertida: não foi possível gerar receita no financeiro');

    return json_build_object(
      'ok', false,
      'erro', 'Não foi possível gerar a receita no financeiro. A aprovação foi desfeita.'
    );
  end if;

  return json_build_object(
    'ok', true,
    'os_id', v_os.id,
    'numero', v_os.numero,
    'tecnico_id', v_os.tecnico_id,
    'cliente_nome', v_os.cliente_nome
  );
end;
$$;

grant execute on function public.portal_aprovar_orcamento(uuid, text, text) to anon, authenticated, service_role;
