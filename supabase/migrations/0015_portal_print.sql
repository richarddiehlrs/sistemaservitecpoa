-- Portal: dados completos para impressão (cliente, equipamento, assinaturas)
-- Rode no SQL Editor do Supabase APÓS 0014.

create or replace function public.os_publica(p_token uuid)
returns json
language sql
security definer set search_path = public
stable
as $$
  select json_build_object(
    'numero', o.numero,
    'status', o.status,
    'defeito', o.defeito_relatado,
    'diagnostico', o.diagnostico,
    'servico', o.servico_executado,
    'valor_itens', o.valor_itens,
    'valor_visita', o.valor_visita,
    'abater_visita', o.abater_visita,
    'desconto', o.desconto,
    'acrescimo', o.acrescimo,
    'valor_total', o.valor_total,
    'garantia_dias', o.garantia_dias,
    'data_abertura', o.data_abertura,
    'data_previsao', o.data_previsao,
    'turno', o.turno,
    'aprovado', o.aprovado,
    'data_aprovacao', o.data_aprovacao,
    'tecnico', o.tecnico,
    'acompanha', o.acompanha,
    'estado_aparelho', o.estado_aparelho,
    'assinatura_cliente', o.assinatura_cliente,
    'assinatura_tecnico', o.assinatura_tecnico,
    'observacao_cliente_ausente', o.observacao_cliente_ausente,
    'cliente_ausente_registrado_at', o.cliente_ausente_registrado_at,
    'cliente_nome', c.nome,
    'equipamento', trim(coalesce(e.tipo,'') || ' ' || coalesce(e.marca,'') || ' ' || coalesce(e.modelo,'')),
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
      'tipo', e.tipo,
      'marca', e.marca,
      'modelo', e.modelo,
      'numero_serie', e.numero_serie,
      'voltagem', e.voltagem,
      'cor', e.cor
    ) else null end,
    'historico', (
      select coalesce(json_agg(json_build_object(
        'status', h.status,
        'observacao', h.observacao,
        'created_at', h.created_at
      ) order by h.created_at), '[]'::json)
      from public.os_status_historico h where h.os_id = o.id
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
  where o.aprovacao_token = p_token;
$$;

-- Corrigir lançamentos já marcados como pago mas com valor_pago zerado
update public.lancamentos_financeiros
  set valor_pago = valor,
      valor_liquido = coalesce(valor_liquido, valor - coalesce(taxa_cartao, 0))
  where status = 'pago' and coalesce(valor_pago, 0) = 0;
