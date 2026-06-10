// Tipos do banco ServitecPoa. Mantenha em sincronia com supabase/migrations.
// Para regenerar automaticamente:
//   npx supabase gen types typescript --project-id SEU_ID > src/types/database.ts

export type StatusOS =
  | "aberta"
  | "em_analise"
  | "aguardando_aprovacao"
  | "aprovada"
  | "em_execucao"
  | "aguardando_peca"
  | "concluida"
  | "entregue"
  | "cancelada"
  | "garantia";

export type Cliente = {
  id: string;
  tipo: "PF" | "PJ";
  nome: string;
  cpf_cnpj: string | null;
  rg_ie: string | null;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ponto_referencia: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Equipamento = {
  id: string;
  cliente_id: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  cor: string | null;
  voltagem: string | null;
  acessorios: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrdemServico = {
  id: string;
  numero: number;
  cliente_id: string;
  equipamento_id: string | null;
  status: StatusOS;
  defeito_relatado: string | null;
  diagnostico: string | null;
  servico_executado: string | null;
  acompanha: string | null;
  estado_aparelho: string | null;
  tecnico: string | null;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  data_abertura: string;
  data_previsao: string | null;
  data_conclusao: string | null;
  data_entrega: string | null;
  valor_visita: number;
  abater_visita: boolean;
  desconto: number;
  acrescimo: number;
  valor_itens: number;
  valor_total: number;
  forma_pagamento: string | null;
  garantia_dias: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type OsItem = {
  id: string;
  os_id: string;
  tipo: "servico" | "peca";
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
  created_at: string;
};

export type OsStatusHistorico = {
  id: string;
  os_id: string;
  status: StatusOS;
  observacao: string | null;
  created_at: string;
};

export type TipoAgendamento =
  | "visita"
  | "coleta"
  | "entrega"
  | "retorno"
  | "orcamento"
  | "outro";

export type Agendamento = {
  id: string;
  os_id: string | null;
  cliente_id: string | null;
  titulo: string;
  tipo: TipoAgendamento;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  tecnico: string | null;
  endereco: string | null;
  status: "agendado" | "confirmado" | "realizado" | "cancelado";
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type CategoriaFinanceira = {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
  grupo_dre: string;
  created_at: string;
};

export type LancamentoFinanceiro = {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  categoria_id: string | null;
  os_id: string | null;
  cliente_id: string | null;
  valor: number;
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: "pendente" | "pago" | "cancelado";
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

type TableDef<T> = {
  Row: Row<T>;
  Insert: Insert<T>;
  Update: Update<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      clientes: TableDef<Cliente>;
      equipamentos: TableDef<Equipamento>;
      ordens_servico: TableDef<OrdemServico>;
      os_itens: TableDef<OsItem>;
      os_status_historico: TableDef<OsStatusHistorico>;
      categorias_financeiras: TableDef<CategoriaFinanceira>;
      lancamentos_financeiros: TableDef<LancamentoFinanceiro>;
      agendamentos: TableDef<Agendamento>;
    };
    Views: {
      vw_dre: {
        Row: {
          mes: string;
          grupo_dre: string;
          tipo: "receita" | "despesa";
          total: number;
        };
      };
      vw_fluxo_caixa: {
        Row: {
          mes: string;
          tipo: "receita" | "despesa";
          total: number;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
