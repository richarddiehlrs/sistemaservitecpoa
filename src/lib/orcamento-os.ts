import type { StatusOS, TipoAtendimento } from "@/types/database";
import { calcValorTotalCliente } from "@/lib/os-valores";

/** Status que podem receber orçamento e ir para aprovação do cliente. */
export const STATUS_ENVIA_ORCAMENTO: StatusOS[] = [
  "aberta",
  "em_analise",
  "em_roteiro",
  "aguardando_aprovacao",
];

/**
 * Domicílio: visita costuma ser cobrada na 1ª visita; orçamento de serviço abate a visita.
 * Só soma visita ao total se o operador marcar explicitamente.
 */
export function resolverAbaterVisita(
  tipo: TipoAtendimento,
  formData: FormData,
  valorItens: number
): boolean {
  if (tipo !== "domicilio") return false;
  const incluirVisita = formData.get("incluir_visita_orcamento") === "on";
  if (incluirVisita) return false;
  // Compatível com formulários antigos
  if (formData.get("abater_visita") === "on") return true;
  // Orçamento com itens: padrão abater visita (não somar ao total)
  if (valorItens > 0) return true;
  return formData.get("abater_visita") !== "off";
}

export function temOrcamentoParaCliente(valorItens: number, total: number): boolean {
  return valorItens > 0.009 || total > 0.009;
}

export function deveEnviarAguardandoAprovacao(opts: {
  tipo: TipoAtendimento;
  aprovado: boolean;
  status: StatusOS;
  valorItens: number;
  total: number;
}): boolean {
  if (opts.tipo !== "domicilio") return false;
  if (opts.aprovado) return false;
  if (opts.status === "aguardando_aprovacao") return false;
  if (!temOrcamentoParaCliente(opts.valorItens, opts.total)) return false;
  return STATUS_ENVIA_ORCAMENTO.includes(opts.status);
}

export function calcTotaisOs(
  itens: { quantidade: number | string; valor_unitario: number | string; custo_unitario?: number | string }[],
  valorVisita: number,
  abaterVisita: boolean,
  desconto: number,
  acrescimo: number
) {
  const valorItens = itens.reduce(
    (s, i) => s + Number(i.quantidade) * Number(i.valor_unitario),
    0
  );
  const custoItens = itens.reduce(
    (s, i) => s + Number(i.quantidade) * Number(i.custo_unitario || 0),
    0
  );
  const total = calcValorTotalCliente(valorItens, valorVisita, abaterVisita, desconto, acrescimo);
  return { valorItens, custoItens, total };
}
