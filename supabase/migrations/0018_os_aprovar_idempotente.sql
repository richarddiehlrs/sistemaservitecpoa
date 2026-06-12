-- os_aprovar idempotente: não duplica histórico nem reprocessa se já aprovado
-- Rode no SQL Editor do Supabase APÓS 0017.

create or replace function public.os_aprovar(
  p_token uuid,
  p_assinatura text default null,
  p_obs text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_ja_aprovado boolean;
  v_status text;
begin
  select id, aprovado, status
    into v_id, v_ja_aprovado, v_status
  from public.ordens_servico
  where aprovacao_token = p_token;

  if v_id is null then
    return json_build_object('ok', false, 'erro', 'OS não encontrada');
  end if;

  if v_ja_aprovado then
    return json_build_object('ok', true, 'ja_aprovada', true);
  end if;

  if v_status = 'cancelada' then
    return json_build_object('ok', false, 'erro', 'OS cancelada');
  end if;

  if v_status = 'cliente_ausente' then
    return json_build_object('ok', false, 'erro', 'Cliente ausente');
  end if;

  update public.ordens_servico
    set aprovado = true,
        data_aprovacao = now(),
        assinatura_cliente = coalesce(p_assinatura, assinatura_cliente),
        observacao_aprovacao = p_obs,
        status = case
          when status in ('aberta', 'em_analise', 'aguardando_aprovacao') then 'aprovada'
          else status
        end
  where id = v_id
    and aprovado = false;

  if not found then
    return json_build_object('ok', true, 'ja_aprovada', true);
  end if;

  insert into public.os_status_historico (os_id, status, observacao)
  values (v_id, 'aprovada', 'Orçamento aprovado pelo cliente (portal)');

  return json_build_object('ok', true);
end;
$$;
