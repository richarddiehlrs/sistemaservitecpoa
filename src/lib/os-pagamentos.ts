import type { SupabaseClient } from "@supabase/supabase-js";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { criarReceitaPendenteOs } from "@/lib/os-financeiro";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

export type TipoPagamentoOs = "visita" | "sinal" | "saldo" | "parcial" | "outro" | "baixa";

export type OsPagamentoRow = {
  id: string;
  os_id: string | null;
  lancamento_id: string | null;
  tipo: TipoPagamentoOs;
  valor: number;
  data_pagamento: string;
  forma_pagamento: string | null;
  conta_id: string | null;
  taxa: number;
  extrato_transacao_id: string | null;
  observacao: string | null;
  registrado_por: string | null;
  created_at: string;
};

export const COLUNAS_PAGAMENTO =
  "id, os_id, lancamento_id, tipo, valor, data_pagamento, forma_pagamento, conta_id, taxa, extrato_transacao_id, observacao, registrado_por, created_at";

/** Calcula valor de sinal com base no saldo e percentual configurável. */
export function calcValorSinal(saldoCliente: number, percentual: number): number {
  const pct = Math.min(100, Math.max(0, Number(percentual) || 0));
  if (saldoCliente <= 0 || pct <= 0) return 0;
  return Math.round(saldoCliente * (pct / 100) * 100) / 100;
}

/** Saldo restante após pagamentos já registrados na receita. */
export function calcSaldoRestanteOs(saldoCliente: number, valorPagoReceita: number): number {
  return Math.max(0, Math.round((saldoCliente - Number(valorPagoReceita || 0)) * 100) / 100);
}

/** Garante receita pendente (após aprovação) antes de registrar pagamento. */
export async function garantirReceitaOs(supabase: Db, osId: string): Promise<boolean> {
  const { count } = await supabase
    .from("lancamentos_financeiros")
    .select("id", { count: "exact", head: true })
    .eq("os_id", osId)
    .eq("tipo", "receita")
    .neq("status", "cancelado");

  if ((count ?? 0) > 0) return true;
  return criarReceitaPendenteOs(supabase, osId);
}

/** Registra pagamento com histórico (RPC) — visita, sinal, saldo ou parcial. */
export async function registrarPagamentoOsComHistorico(
  supabase: Db,
  opts: {
    osId: string;
    valor: number;
    tipo: TipoPagamentoOs;
    formaPagamento?: string | null;
    observacao?: string | null;
    /** YYYY-MM-DD — permite lançar pagamento recebido em outro dia. */
    dataPagamento?: string | null;
    garantirReceita?: boolean;
  }
): Promise<void> {
  const valor = Math.round(Number(opts.valor) * 100) / 100;
  if (valor <= 0) throw new Error("Informe um valor maior que zero.");

  if (opts.garantirReceita !== false) {
    const ok = await garantirReceitaOs(supabase, opts.osId);
    if (!ok) throw new Error("Não foi possível preparar o financeiro da OS.");
  }

  const { data, error } = await supabase.rpc("registrar_pagamento_os_com_historico", {
    p_os_id: opts.osId,
    p_valor: valor,
    p_tipo: opts.tipo,
    p_forma_pagamento: opts.formaPagamento ?? null,
    p_observacao: opts.observacao ?? null,
    p_data_pagamento: opts.dataPagamento ?? null,
  });

  if (error) {
    throw new Error(`Não foi possível registrar o pagamento: ${error.message}`);
  }
  if (!data) {
    throw new Error("Pagamento não registrado — verifique se a receita da OS existe.");
  }
}

export async function listarPagamentosOs(
  supabase: Db,
  osId: string
): Promise<OsPagamentoRow[]> {
  const { data } = await supabase
    .from("os_pagamentos")
    .select(COLUNAS_PAGAMENTO)
    .eq("os_id", osId)
    .order("data_pagamento", { ascending: true })
    .order("created_at", { ascending: true });

  return (data || []) as OsPagamentoRow[];
}

export const LABEL_TIPO_PAGAMENTO: Record<TipoPagamentoOs, string> = {
  visita: "Visita técnica",
  sinal: "Entrada / sinal",
  saldo: "Saldo final",
  parcial: "Pagamento parcial",
  outro: "Outro",
  baixa: "Pagamento",
};

/** Resumo financeiro consolidado para OS (total, pago, saldo). */
export async function resumoFinanceiroOsCompleto(
  supabase: Db,
  os: {
    id: string;
    valor_itens: number;
    valor_visita: number;
    abater_visita: boolean;
    desconto: number;
    acrescimo: number;
    aprovado: boolean;
    motivo_atendimento?: string | null;
  }
) {
  const saldoCliente = calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );

  const { data: receita } = await supabase
    .from("lancamentos_financeiros")
    .select("valor, valor_pago, status")
    .eq("os_id", os.id)
    .eq("tipo", "receita")
    .neq("status", "cancelado")
    .maybeSingle();

  const valorPago = Number(receita?.valor_pago) || 0;
  const pagamentos = await listarPagamentosOs(supabase, os.id);
  const visitaPaga =
    pagamentos.some((p) => p.tipo === "visita") ||
    (Boolean(os.abater_visita) && Number(os.valor_visita) > 0 && valorPago > 0);

  return {
    totalCliente: saldoCliente,
    valorPago,
    saldoRestante: calcSaldoRestanteOs(saldoCliente, valorPago),
    statusReceita: receita?.status ?? null,
    visitaPaga,
    pagamentos,
    retornoGarantia: os.motivo_atendimento === "retorno_garantia",
    aprovado: os.aprovado,
  };
}
