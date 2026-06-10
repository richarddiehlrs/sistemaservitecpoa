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
): { prefixo: string; valor: number } {
  const v = Number(valorVisita) || 0;
  if (v <= 0) return { prefixo: "", valor: 0 };
  return abaterVisita ? { prefixo: "- ", valor: v } : { prefixo: "+ ", valor: v };
}
