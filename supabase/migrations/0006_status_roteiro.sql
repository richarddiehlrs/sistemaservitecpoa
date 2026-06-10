-- =====================================================================
-- ServitecPoa ERP - Novo status de OS: "em_roteiro" (Em roteiro p/ atendimento)
-- Rode no SQL Editor do Supabase APÓS 0005.
-- =====================================================================

alter table public.ordens_servico
  drop constraint if exists ordens_servico_status_check;

alter table public.ordens_servico
  add constraint ordens_servico_status_check
  check (status in ('aberta','em_analise','aguardando_aprovacao',
                    'aprovada','em_roteiro','em_execucao','aguardando_peca',
                    'concluida','entregue','cancelada','garantia'));
