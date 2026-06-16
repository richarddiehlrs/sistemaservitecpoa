-- Portal: campos de retorno em garantia (sobre os_publica existente)
-- Rode APÓS 0033_retorno_garantia.sql

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
      'cpf_cnpj', c.cpf_cnpj,
      'telefone', c.telefone,
      'logradouro', c.logradouro,
      'numero', c.numero,
      'complemento', c.complemento,
      'bairro', c.bairro,
      'cidade', c.cidade,
      'uf', c.uf,
      'cep', c.cep
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
  where o.aprovacao_token = p_token;
$$;

grant execute on function public.os_publica(uuid) to anon, authenticated;
