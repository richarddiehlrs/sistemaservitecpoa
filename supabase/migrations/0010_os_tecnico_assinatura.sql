-- =====================================================================
-- ServitecPoa ERP - Técnico obrigatório, cliente ausente, assinatura técnico
-- Rode no SQL Editor do Supabase APÓS 0009.
-- =====================================================================

-- Novo status: cliente ausente (técnico assina e registra foto)
alter table public.ordens_servico
  drop constraint if exists ordens_servico_status_check;
alter table public.ordens_servico
  add constraint ordens_servico_status_check
  check (status in (
    'aberta','em_analise','aguardando_aprovacao','aprovada',
    'em_roteiro','em_execucao','aguardando_peca','cliente_ausente',
    'concluida','entregue','cancelada','garantia'
  ));

-- Vínculo com técnico cadastrado (profiles)
alter table public.ordens_servico
  add column if not exists tecnico_id uuid references public.profiles(id) on delete set null,
  add column if not exists assinatura_tecnico text,
  add column if not exists cliente_ausente_registrado_at timestamptz,
  add column if not exists observacao_cliente_ausente text;

create index if not exists idx_os_tecnico_id on public.ordens_servico (tecnico_id);

-- Foto comprobatória quando cliente ausente
alter table public.os_anexos
  drop constraint if exists os_anexos_momento_check;
alter table public.os_anexos
  add constraint os_anexos_momento_check
  check (momento in ('antes','depois','cliente_ausente','outro'));
