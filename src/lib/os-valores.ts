/**
 * Total a pagar pelo cliente.
 * - abater_visita = true: visita já foi paga → desconta do serviço
 * - abater_visita = false: visita cobrada junto → soma ao serviço
 */
export function calcValorTotalCliente(
  valorItens: number,
  valorVisita: number,
  abaterVisita: boolean,
  desconto: number,
  acrescimo: number
): number {
  const base = Number(valorItens) + Number(acrescimo) - Number(desconto);
  const total = abaterVisita
    ? base - Number(valorVisita)
    : base + Number(valorVisita);
  return Math.max(0, Math.round(total * 100) / 100);
}

/** Subtotal de serviços/peças antes da visita. */
export function calcSubtotalServicosOs(
  valorItens: number,
  desconto: number,
  acrescimo: number
): number {
  return Math.max(
    0,
    Math.round((Number(valorItens) + Number(acrescimo) - Number(desconto)) * 100) / 100
  );
}

/**
 * Valor nominal da receita (competência / faturamento).
 * Com visita abatida: faturamento = subtotal dos serviços (visita entra como pagamento, não reduz receita).
 */
export function calcReceitaFaturamentoOs(
  valorItens: number,
  valorVisita: number,
  abaterVisita: boolean,
  desconto: number,
  acrescimo: number
): number {
  if (abaterVisita) {
    return calcSubtotalServicosOs(valorItens, desconto, acrescimo);
  }
  return calcValorTotalCliente(valorItens, valorVisita, false, desconto, acrescimo);
}

export function linhaVisitaValor(
  valorVisita: number,
  abaterVisita: boolean
): { prefixo: string; valor: number; label: string } {
  const v = Number(valorVisita) || 0;
  if (v <= 0) return { prefixo: "", valor: 0, label: "" };
  if (abaterVisita) {
    return {
      prefixo: "- ",
      valor: v,
      label: "Visita técnica (já paga — abatida do reparo)",
    };
  }
  return {
    prefixo: "+ ",
    valor: v,
    label: "Visita técnica",
  };
}

/** Resumo financeiro para check-out do técnico. */
export type OsResumoCheckout = {
  valorVisita: number;
  abaterVisita: boolean;
  saldoCliente: number;
  faturamento: number;
  valorPago: number;
  saldoRestante: number;
  visitaPaga: boolean;
  aprovado: boolean;
  retornoGarantia?: boolean;
};

export function resumoFinanceiroOs(
  os: {
    valor_itens: number;
    valor_visita: number;
    abater_visita: boolean;
    desconto: number;
    acrescimo: number;
    motivo_atendimento?: string | null;
    aprovado?: boolean;
  },
  extras?: { valorPago?: number; visitaPaga?: boolean }
): OsResumoCheckout {
  const valorItens = Number(os.valor_itens) || 0;
  const valorVisita = Number(os.valor_visita) || 0;
  const desconto = Number(os.desconto) || 0;
  const acrescimo = Number(os.acrescimo) || 0;
  const abaterVisita = Boolean(os.abater_visita);
  const saldoCliente = calcValorTotalCliente(valorItens, valorVisita, abaterVisita, desconto, acrescimo);
  const valorPago = Number(extras?.valorPago) || 0;
  const visitaPaga =
    Boolean(extras?.visitaPaga) ||
    (abaterVisita && valorVisita > 0 && valorPago + 0.001 >= valorVisita);
  return {
    valorVisita,
    abaterVisita,
    saldoCliente,
    faturamento: calcReceitaFaturamentoOs(valorItens, valorVisita, abaterVisita, desconto, acrescimo),
    valorPago,
    saldoRestante: Math.max(0, Math.round((saldoCliente - valorPago) * 100) / 100),
    visitaPaga,
    aprovado: Boolean(os.aprovado),
    retornoGarantia: os.motivo_atendimento === "retorno_garantia",
  };
}

export function resumoOrcamentoCliente(opts: {
  valor_itens: number;
  valor_visita: number;
  abater_visita: boolean;
  desconto?: number;
  acrescimo?: number;
}) {
  const valorItens = Number(opts.valor_itens) || 0;
  const valorVisita = Number(opts.valor_visita) || 0;
  const desconto = Number(opts.desconto) || 0;
  const acrescimo = Number(opts.acrescimo) || 0;
  const abaterVisita = Boolean(opts.abater_visita);

  const subtotalServicos = Math.round((valorItens + acrescimo - desconto) * 100) / 100;
  const total = calcValorTotalCliente(valorItens, valorVisita, abaterVisita, desconto, acrescimo);
  const visitaLinha = linhaVisitaValor(valorVisita, abaterVisita);

  return {
    valorItens,
    valorVisita,
    abaterVisita,
    desconto,
    acrescimo,
    subtotalServicos,
    total,
    visitaLinha,
    mostraAbatimentoVisita: abaterVisita && valorVisita > 0,
    labelTotal: abaterVisita && valorVisita > 0 ? "Total do reparo (resta pagar)" : "Total",
    textoVisitaPaga:
      abaterVisita && valorVisita > 0
        ? `A visita técnica de ${valorVisita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} já foi paga na primeira ida e foi abatida do valor do reparo.`
        : null,
  };
}
