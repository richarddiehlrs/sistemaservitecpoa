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

/** Resumo legível para portal, ERP e impressão. */
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
