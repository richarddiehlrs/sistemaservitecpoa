-- Plano B — Segurança (sem restringir leitura de clientes para técnico)
-- Rode APÓS 0034_portal_retorno_garantia.sql

-- =====================================================================
-- Helpers
-- =====================================================================

create or replace function public.pode_alterar_financeiro_os(p_os_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.pode_operacao_erp()
    or public.os_do_tecnico(p_os_id);
$$;

create or replace function public.storage_path_os_id(path text)
returns uuid
language sql
immutable
as $$
  select case
    when path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      then split_part(path, '/', 1)::uuid
    else null
  end;
$$;

create or replace function public.pode_acessar_storage_os(path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.pode_operacao_erp()
    or (
      public.storage_path_os_id(path) is not null
      and public.os_do_tecnico(public.storage_path_os_id(path))
    );
$$;

-- OS atribuída ao técnico (sem pool aberto para itens/anexos/financeiro)
create or replace function public.os_do_tecnico(p_os_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ordens_servico o
    where o.id = p_os_id
      and o.tecnico_id = auth.uid()
  );
$$;

-- Escanear etiqueta: operação vê tudo; técnico vê atribuída ou oficina sem técnico
create or replace function public.resolver_os_escaneamento(
  p_numero integer default null,
  p_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v record;
begin
  if p_id is not null then
    select o.id, o.tecnico_id, o.tipo_atendimento, o.status
      into v
    from public.ordens_servico o
    where o.id = p_id;
  elsif p_numero is not null then
    select o.id, o.tecnico_id, o.tipo_atendimento, o.status
      into v
    from public.ordens_servico o
    where o.numero = p_numero;
  else
    return null;
  end if;

  if not found or v.status = 'cancelada' then
    return null;
  end if;

  if public.pode_operacao_erp() then
    return v.id;
  end if;

  if v.tecnico_id = auth.uid() then
    return v.id;
  end if;

  if public.meu_papel() = 'tecnico'
    and v.tecnico_id is null
    and v.tipo_atendimento = 'oficina'
    and v.status not in ('concluida', 'entregue', 'cancelada')
  then
    return v.id;
  end if;

  return null;
end;
$$;

grant execute on function public.resolver_os_escaneamento(integer, uuid) to authenticated;

-- =====================================================================
-- RLS: pool aberto só na listagem de OS (claim via update); itens usam os_do_tecnico estrito
-- =====================================================================

drop policy if exists os_select on public.ordens_servico;
drop policy if exists os_update on public.ordens_servico;

create policy os_select on public.ordens_servico
  for select to authenticated
  using (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
  );

-- Técnico pode assumir OS sem técnico (check-in / escanear oficina)
create policy os_update on public.ordens_servico
  for update to authenticated
  using (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
    or (public.meu_papel() = 'tecnico' and tecnico_id is null)
  )
  with check (
    public.pode_operacao_erp()
    or tecnico_id = auth.uid()
  );

-- Agenda: técnico só insere visita atribuída a si
drop policy if exists ag_insert on public.agendamentos;

create policy ag_insert on public.agendamentos
  for insert to authenticated
  with check (
    public.pode_operacao_erp()
    or (public.meu_papel() = 'tecnico' and tecnico_id = auth.uid())
  );

-- =====================================================================
-- Storage: escrita/deleção restrita; leitura pública mantida (portal anexos)
-- =====================================================================

drop policy if exists "servitec auth update" on storage.objects;
drop policy if exists "servitec auth delete" on storage.objects;
drop policy if exists "servitec auth insert" on storage.objects;

create policy "servitec auth insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'empresa' and public.pode_operacao_erp()
    or (
      bucket_id = 'os-fotos'
      and public.pode_acessar_storage_os(name)
    )
  );

create policy "servitec auth update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'empresa' and public.pode_operacao_erp()
    or (bucket_id = 'os-fotos' and public.pode_acessar_storage_os(name))
  )
  with check (
    bucket_id = 'empresa' and public.pode_operacao_erp()
    or (bucket_id = 'os-fotos' and public.pode_acessar_storage_os(name))
  );

create policy "servitec auth delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'empresa' and public.pode_operacao_erp()
    or (bucket_id = 'os-fotos' and public.pode_acessar_storage_os(name))
  );

-- =====================================================================
-- Signup: novos usuários = técnico inativo (primeiro usuário continua admin)
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primeiro boolean;
begin
  select not exists (select 1 from public.profiles limit 1) into v_primeiro;

  insert into public.profiles (id, email, nome, papel, ativo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    case when v_primeiro then 'admin' else 'tecnico' end,
    v_primeiro
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- =====================================================================
-- RPCs financeiras: exige operação ERP ou técnico da OS
-- =====================================================================

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
  if not public.pode_alterar_financeiro_os(p_os_id) then
    return false;
  end if;

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
        observacoes = coalesce(nullif(trim(p_observacao), ''), observacoes)
  where id = v_receita.id;

  return true;
end;
$$;

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
  if not public.pode_alterar_financeiro_os(p_os_id) then
    return false;
  end if;

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

-- Portal: menos PII + OS cancelada inacessível
create or replace function public.os_publica(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'numero', o.numero,
    'status', o.status,
    'aprovado', o.aprovado,
    'motivo_atendimento', o.motivo_atendimento,
    'os_origem_numero', orig.numero,
    'data_abertura', o.data_abertura,
    'data_aprovacao', o.data_aprovacao,
    'data_previsao', o.data_previsao,
    'turno', o.turno,
    'tecnico', o.tecnico,
    'garantia_dias', o.garantia_dias,
    'defeito', o.defeito_relatado,
    'diagnostico', o.diagnostico,
    'servico', o.servico_executado,
    'valor_itens', o.valor_itens,
    'valor_visita', o.valor_visita,
    'abater_visita', o.abater_visita,
    'desconto', o.desconto,
    'acrescimo', o.acrescimo,
    'valor_total', o.valor_total,
    'forma_pagamento', o.forma_pagamento,
    'cliente_nome', c.nome,
    'equipamento', trim(both ' ' from concat_ws(' ', e.tipo, e.marca, e.modelo)),
    'cliente_ausente_registrado_at', o.cliente_ausente_registrado_at,
    'observacao_cliente_ausente', o.observacao_cliente_ausente,
    'assinatura_cliente', o.assinatura_cliente,
    'assinatura_tecnico', o.assinatura_tecnico,
    'equipamentos', coalesce(
      (
        select json_agg(json_build_object(
          'tipo', eq.tipo, 'marca', eq.marca, 'modelo', eq.modelo,
          'numero_serie', eq.numero_serie, 'voltagem', eq.voltagem, 'cor', eq.cor
        ) order by oe.ordem nulls last, eq.created_at)
        from public.os_equipamentos oe
        join public.equipamentos eq on eq.id = oe.equipamento_id
        where oe.os_id = o.id
      ),
      case when e.id is not null then json_build_array(json_build_object(
        'tipo', e.tipo, 'marca', e.marca, 'modelo', e.modelo,
        'numero_serie', e.numero_serie, 'voltagem', e.voltagem, 'cor', e.cor
      )) else '[]'::json end
    ),
    'cliente', json_build_object(
      'nome', c.nome,
      'telefone', case
        when c.telefone is null or length(regexp_replace(c.telefone, '\D', '', 'g')) < 4 then c.telefone
        else regexp_replace(c.telefone, '.(?=.{4})', '*', 'g')
      end,
      'cidade', c.cidade,
      'uf', c.uf,
      'bairro', c.bairro
    ),
    'equipamento_detalhe', case when e.id is not null then json_build_object(
      'tipo', e.tipo, 'marca', e.marca, 'modelo', e.modelo,
      'numero_serie', e.numero_serie, 'voltagem', e.voltagem, 'cor', e.cor
    ) else null end,
    'historico', (
      select coalesce(json_agg(json_build_object(
        'status', h.status,
        'observacao', case
          when h.observacao ilike '%via erp%' or h.observacao ilike '%atualizado via%' then null
          when h.observacao ilike '%receita pendente cancelada%' then 'Orçamento atualizado — nova aprovação necessária.'
          else h.observacao
        end,
        'created_at', h.created_at
      ) order by h.created_at), '[]'::json)
      from public.os_status_historico h
      where h.os_id = o.id
        and h.status not in ('cancelada')
    ),
    'itens', (
      select coalesce(json_agg(json_build_object(
        'descricao', i.descricao, 'tipo', i.tipo,
        'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario, 'subtotal', i.subtotal
      ) order by i.created_at), '[]'::json)
      from public.os_itens i where i.os_id = o.id
    ),
    'anexos_ausente', (
      select coalesce(json_agg(json_build_object(
        'url', a.url, 'descricao', a.descricao
      ) order by a.created_at), '[]'::json)
      from public.os_anexos a where a.os_id = o.id and a.momento = 'cliente_ausente'
    ),
    'proximo_agendamento', (
      select json_build_object(
        'data', a.data,
        'hora_inicio', a.hora_inicio,
        'hora_fim', a.hora_fim,
        'turno', a.turno,
        'status', a.status,
        'endereco', a.endereco
      )
      from public.agendamentos a
      where a.os_id = o.id
        and a.status in ('agendado', 'confirmado')
        and a.data >= (timezone('America/Sao_Paulo', now()))::date
      order by a.data asc, a.hora_inicio asc nulls last
      limit 1
    ),
    'nps', (
      select json_build_object(
        'nota', n.nota,
        'comentario', n.comentario,
        'created_at', n.created_at
      )
      from public.os_nps n
      where n.os_id = o.id
    ),
    'empresa', (select json_build_object(
        'nome', cfg.nome, 'cnpj', cfg.cnpj, 'telefone', cfg.telefone, 'email', cfg.email,
        'endereco', cfg.endereco, 'cidade', cfg.cidade,
        'logo_url', cfg.logo_url, 'termo_garantia', cfg.termo_garantia,
        'politica_os', cfg.politica_os
      ) from public.configuracoes cfg where cfg.id = 1)
  )
  from public.ordens_servico o
  join public.clientes c on c.id = o.cliente_id
  left join public.equipamentos e on e.id = o.equipamento_id
  left join public.ordens_servico orig on orig.id = o.os_origem_id
  where o.aprovacao_token = p_token
    and o.status <> 'cancelada';
$$;
