// Tipos do banco ServitecPoa. Mantenha em sincronia com supabase/migrations.
// Para regenerar automaticamente:
//   npx supabase gen types typescript --project-id SEU_ID > src/types/database.ts

export type TipoAtendimento = "domicilio" | "oficina";

export type StatusOS =
  | "aberta"
  | "em_analise"
  | "aguardando_aprovacao"
  | "aprovada"
  | "em_roteiro"
  | "em_execucao"
  | "aguardando_peca"
  | "cliente_ausente"
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
  tipo_atendimento: TipoAtendimento;
  defeito_relatado: string | null;
  diagnostico: string | null;
  servico_executado: string | null;
  acompanha: string | null;
  estado_aparelho: string | null;
  tecnico: string | null;
  tecnico_id: string | null;
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
  turno: "manha" | "tarde" | "dia" | null;
  custo_total: number;
  aprovacao_token: string;
  aprovado: boolean;
  data_aprovacao: string | null;
  assinatura_cliente: string | null;
  assinatura_tecnico: string | null;
  cliente_ausente_registrado_at: string | null;
  observacao_cliente_ausente: string | null;
  observacao_aprovacao: string | null;
  created_at: string;
  updated_at: string;
};

export type Configuracao = {
  id: number;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  logo_url: string | null;
  termo_garantia: string | null;
  politica_os: string | null;
  msg_whatsapp: string | null;
  comissao_percent: number | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  nome: string | null;
  email: string | null;
  papel: "admin" | "atendente" | "tecnico";
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type ServicoCatalogo = {
  id: string;
  descricao: string;
  tipo: "servico" | "peca";
  valor: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type OsAnexo = {
  id: string;
  os_id: string;
  url: string;
  path: string | null;
  descricao: string | null;
  momento: "antes" | "depois" | "cliente_ausente" | "outro";
  created_at: string;
};

export type OsItem = {
  id: string;
  os_id: string;
  tipo: "servico" | "peca";
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
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
  turno: "manha" | "tarde" | "dia" | null;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  tecnico: string | null;
  tecnico_id: string | null;
  endereco: string | null;
  status: "agendado" | "confirmado" | "em_atendimento" | "realizado" | "cancelado";
  observacoes: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  checkin_por: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  created_at: string;
  updated_at: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  updated_at: string;
};

export type PosicaoTecnico = {
  user_id: string;
  tecnico_nome: string | null;
  lat: number;
  lng: number;
  precisao: number | null;
  em_atendimento: boolean;
  agendamento_id: string | null;
  atualizado_at: string;
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
  valor_pago: number;
  juros: number;
  multa: number;
  taxa_cartao: number;
  valor_liquido: number | null;
  parcela_num: number | null;
  parcela_total: number | null;
  recorrencia_id: string | null;
  tecnico: string | null;
  criado_por: string | null;
  origem: "sistema" | "campo";
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: "pendente" | "parcial" | "pago" | "cancelado";
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type DespesaRecorrente = {
  id: string;
  descricao: string;
  categoria_id: string | null;
  valor: number;
  dia_vencimento: number;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaFaturamento = {
  id: string;
  ano: number;
  mes: number;
  valor: number;
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
      push_subscriptions: TableDef<PushSubscription>;
      posicoes_tecnico: TableDef<PosicaoTecnico>;
      configuracoes: TableDef<Configuracao>;
      profiles: TableDef<Profile>;
      servicos_catalogo: TableDef<ServicoCatalogo>;
      os_anexos: TableDef<OsAnexo>;
      despesas_recorrentes: TableDef<DespesaRecorrente>;
      metas_faturamento: TableDef<MetaFaturamento>;
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
    Functions: {
      os_publica: {
        Args: { p_token: string };
        Returns: unknown;
      };
      os_aprovar: {
        Args: { p_token: string; p_assinatura?: string | null; p_obs?: string | null };
        Returns: unknown;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
};
