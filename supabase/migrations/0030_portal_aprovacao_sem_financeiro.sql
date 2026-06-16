-- Corrige função duplicada criar_receita_os_interno(uuid) + aprovação portal sem financeiro
-- Financeiro do serviço: só na conclusão (check-out serviço executado)
-- Rode APÓS 0029_financeiro_checkout_tecnico.sql

drop function if exists public.criar_receita_os_interno(uuid);

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
    return json_build_object('ok', true, 'ja_aprovada', true, 'os_id', v_os.id);
  end if;

  insert into public.os_status_historico (os_id, status, observacao)
  values (v_os.id, v_novo_status, 'Orçamento aprovado (portal do cliente)');

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
