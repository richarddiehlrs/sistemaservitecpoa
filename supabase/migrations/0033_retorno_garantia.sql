-- Retorno em garantia: OS vinculada à original + categoria financeira
-- Rode APÓS 0032_checkout_pagamento_os.sql

alter table public.ordens_servico
  add column if not exists os_origem_id uuid references public.ordens_servico(id) on delete set null,
  add column if not exists motivo_atendimento text not null default 'normal'
    check (motivo_atendimento in ('normal', 'retorno_garantia'));

create index if not exists idx_os_origem on public.ordens_servico (os_origem_id);
create index if not exists idx_os_motivo on public.ordens_servico (motivo_atendimento);

comment on column public.ordens_servico.os_origem_id is
  'OS original quando motivo_atendimento = retorno_garantia';
comment on column public.ordens_servico.motivo_atendimento is
  'normal = serviço cobrado; retorno_garantia = retorno dentro da garantia (sem receita automática)';

-- Permite grupo DRE específico para prejuízo de garantia
alter table public.categorias_financeiras
  drop constraint if exists categorias_financeiras_grupo_dre_check;

alter table public.categorias_financeiras
  add constraint categorias_financeiras_grupo_dre_check
  check (grupo_dre in (
    'receita_servico', 'receita_pecas', 'outras_receitas',
    'custo_pecas', 'custo_servico', 'custo_garantia',
    'despesa_operacional', 'despesa_administrativa', 'despesa_financeira', 'impostos'
  ));

insert into public.categorias_financeiras (nome, tipo, grupo_dre)
select 'Custo retorno garantia', 'despesa', 'custo_garantia'
where not exists (
  select 1 from public.categorias_financeiras c where c.nome = 'Custo retorno garantia'
);

insert into public.categorias_financeiras (nome, tipo, grupo_dre)
select 'Receita retorno garantia', 'receita', 'outras_receitas'
where not exists (
  select 1 from public.categorias_financeiras c where c.nome = 'Receita retorno garantia'
);

-- Conclusão de retorno garantia: só custo + receita manual (sem faturamento automático)
create or replace function public.sincronizar_financeiro_retorno_garantia(
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
  v_hoje date;
  v_numero_fmt text;
  v_cat_custo uuid;
  v_cat_receita uuid;
begin
  select *
    into v_os
  from public.ordens_servico o
  where o.id = p_os_id;

  if not found
    or v_os.status = 'cancelada'
    or v_os.motivo_atendimento <> 'retorno_garantia'
  then
    return false;
  end if;

  v_hoje := (timezone('America/Sao_Paulo', now()))::date;
  v_numero_fmt := 'OS-' || lpad(v_os.numero::text, 5, '0');

  select id into v_cat_custo
  from public.categorias_financeiras
  where nome = 'Custo retorno garantia'
  limit 1;

  select id into v_cat_receita
  from public.categorias_financeiras
  where nome = 'Receita retorno garantia'
  limit 1;

  if coalesce(v_os.custo_total, 0) > 0 then
    if exists (
      select 1 from public.lancamentos_financeiros l
      where l.os_id = p_os_id
        and l.tipo = 'despesa'
        and l.descricao like 'Custo garantia %'
        and l.status <> 'cancelado'
    ) then
      update public.lancamentos_financeiros
        set valor = v_os.custo_total
      where os_id = p_os_id
        and tipo = 'despesa'
        and descricao like 'Custo garantia %'
        and status <> 'cancelado';
    else
      insert into public.lancamentos_financeiros (
        tipo, descricao, categoria_id, os_id, cliente_id,
        valor, valor_pago, data_competencia, data_vencimento,
        status, origem, observacoes
      ) values (
        'despesa',
        'Custo garantia ' || v_numero_fmt,
        v_cat_custo,
        v_os.id,
        v_os.cliente_id,
        v_os.custo_total,
        0,
        v_hoje,
        v_hoje,
        'pendente',
        'sistema',
        coalesce(nullif(trim(p_observacao), ''), 'Custo do retorno em garantia — prejuízo operacional')
      );
    end if;
  end if;

  -- Receita zerada/pendente: valor informado só no pagamento manual (checkout ou financeiro)
  if not exists (
    select 1 from public.lancamentos_financeiros l
    where l.os_id = p_os_id
      and l.tipo = 'receita'
      and l.status <> 'cancelado'
  ) and coalesce(v_os.valor_total, 0) > 0 then
    insert into public.lancamentos_financeiros (
      tipo, descricao, categoria_id, os_id, cliente_id,
      valor, valor_pago, data_competencia, data_vencimento,
      status, origem, forma_pagamento, observacoes
    ) values (
      'receita',
      'Receita garantia ' || v_numero_fmt,
      v_cat_receita,
      v_os.id,
      v_os.cliente_id,
      v_os.valor_total,
      0,
      v_hoje,
      v_hoje,
      'pendente',
      'sistema',
      v_os.forma_pagamento,
      'Valor cobrado do cliente no retorno — registrar pagamento ao concluir'
    );
  end if;

  return true;
end;
$$;

grant execute on function public.sincronizar_financeiro_retorno_garantia(uuid, text) to authenticated, service_role;
