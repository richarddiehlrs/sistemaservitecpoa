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
  local_equipamento?: "cliente" | "oficina" | "transito" | "entregue";
  etapa_atual?: string | null;
  etapa_em?: string | null;
  data_conclusao: string | null;
  data_entrega: string | null;
  valor_visita: number;
  abater_visita: boolean;
  desconto: number;
  acrescimo: number;
  valor_itens: number;
  valor_total: number;
  valor_aprovado: number | null;
  forma_pagamento: string | null;
  garantia_dias: number;
  motivo_atendimento?: "normal" | "retorno_garantia";
  os_origem_id?: string | null;
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
  percentual_sinal_padrao: number | null;
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

export type OsEquipamento = {
  id: string;
  os_id: string;
  equipamento_id: string;
  ordem: number;
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
  comprovante_path: string | null;
  km_veiculo: number | null;
  litros: number | null;
  id_cliente: string | null;
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

/** Livro de pagamentos: uma linha por recebimento/pagamento (OS ou avulso). */
export type OsPagamento = {
  id: string;
  os_id: string | null;
  lancamento_id: string | null;
  tipo: "visita" | "sinal" | "saldo" | "parcial" | "outro" | "baixa";
  valor: number;
  data_pagamento: string;
  forma_pagamento: string | null;
  conta_id: string | null;
  taxa: number;
  extrato_transacao_id: string | null;
  observacao: string | null;
  registrado_por: string | null;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type OsEtapa = {
  id: string;
  os_id: string;
  etapa: string;
  observacao: string | null;
  previsao: string | null;
  registrado_por: string | null;
  created_at: string;
};

export type ContaFinanceira = {
  id: string;
  nome: string;
  tipo: "banco" | "maquininha" | "caixa" | "outro";
  banco: string | null;
  agencia: string | null;
  numero: string | null;
  formas_padrao: string[];
  saldo_inicial: number;
  data_saldo_inicial: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type ExtratoImportacao = {
  id: string;
  conta_id: string;
  arquivo_nome: string | null;
  formato: "ofx" | "csv" | "pdf" | "manual";
  periodo_inicio: string | null;
  periodo_fim: string | null;
  saldo_final: number | null;
  qtd_transacoes: number;
  qtd_duplicadas: number;
  importado_por: string | null;
  created_at: string;
};

export type ExtratoTransacao = {
  id: string;
  conta_id: string;
  importacao_id: string | null;
  data: string;
  valor: number;
  descricao: string;
  documento: string | null;
  chave: string;
  status: "pendente" | "conciliado" | "ignorado";
  lancamento_id: string | null;
  taxa_ajuste: number;
  taxa_pagamento_id: string | null;
  observacao: string | null;
  conciliado_por: string | null;
  conciliado_em: string | null;
  created_at: string;
};

export type TipoNotificacaoDb =
  | "os_nova"
  | "os_aprovada"
  | "os_status"
  | "cliente_ausente"
  | "despesa_campo"
  | "financeiro"
  | "oficina_parada"
  | "meta_faturamento"
  | "sistema";

export type Notificacao = {
  id: string;
  user_id: string;
  tipo: TipoNotificacaoDb;
  titulo: string;
  mensagem: string;
  url: string | null;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  lida: boolean;
  lida_em: string | null;
  ref_tipo: string | null;
  ref_id: string | null;
  created_at: string;
};

export type PreferenciasAlertas = {
  user_id: string;
  push_ativo: boolean;
  os_nova: boolean;
  os_status: boolean;
  os_aprovada: boolean;
  cliente_ausente: boolean;
  despesa_campo: boolean;
  financeiro: boolean;
  oficina_parada: boolean;
  meta_faturamento: boolean;
  email_resumo: boolean;
  dias_oficina_parada: number;
  alertas_dispensados: AlertaDispensadoDb[];
  updated_at: string;
};

export type AlertaDispensadoDb = {
  ref_tipo: string;
  ref_id: string | null;
  dispensado_em: string;
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
      os_equipamentos: TableDef<OsEquipamento>;
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
      os_pagamentos: TableDef<OsPagamento>;
      contas_financeiras: TableDef<ContaFinanceira>;
      os_etapas: TableDef<OsEtapa>;
      extrato_importacoes: TableDef<ExtratoImportacao>;
      extrato_transacoes: TableDef<ExtratoTransacao>;
      notificacoes: TableDef<Notificacao>;
      preferencias_alertas: TableDef<PreferenciasAlertas>;
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
      criar_receita_os_interno: {
        Args: { p_os_id: string; p_observacao?: string | null };
        Returns: boolean;
      };
      registrar_pagamento_os_checkout: {
        Args: {
          p_os_id: string;
          p_valor: number;
          p_forma_pagamento?: string | null;
          p_observacao?: string | null;
        };
        Returns: boolean;
      };
      registrar_pagamento_os_com_historico: {
        Args: {
          p_os_id: string;
          p_valor: number;
          p_tipo?: string | null;
          p_forma_pagamento?: string | null;
          p_observacao?: string | null;
          p_data_pagamento?: string | null;
        };
        Returns: boolean;
      };
      conciliar_transacao: {
        Args: { p_transacao_id: string; p_pagamento_ids: string[]; p_diferenca_como_taxa?: boolean };
        Returns: undefined;
      };
      lancar_despesa_campo: {
        Args: {
          p_id_cliente: string;
          p_categoria: string;
          p_valor: number;
          p_data?: string | null;
          p_conta_id?: string | null;
          p_forma?: string | null;
          p_os_id?: string | null;
          p_descricao?: string | null;
          p_km?: number | null;
          p_litros?: number | null;
          p_comprovante_path?: string | null;
        };
        Returns: string;
      };
      excluir_despesa_campo: {
        Args: { p_id: string };
        Returns: string | null;
      };
      desconciliar_transacao: {
        Args: { p_transacao_id: string };
        Returns: undefined;
      };
      criar_lancamento_de_transacao: {
        Args: {
          p_transacao_id: string;
          p_descricao: string;
          p_categoria_id?: string | null;
          p_cliente_id?: string | null;
        };
        Returns: string;
      };
      sincronizar_financeiro_retorno_garantia: {
        Args: { p_os_id: string; p_observacao?: string | null };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
};
