import type { Papel } from "@/lib/permissoes";
import { STATUS_OS_LABEL } from "@/lib/format";
import type { StatusOS } from "@/types/database";

/** Transições permitidas para admin e atendente. */
const TRANSICOES_OPERACAO: Partial<Record<StatusOS, StatusOS[]>> = {
  aberta: ["em_analise", "cancelada"],
  em_analise: ["aguardando_aprovacao", "aguardando_peca", "aprovada", "cancelada", "aberta"],
  aguardando_aprovacao: ["aprovada", "em_analise", "em_roteiro", "cancelada"],
  aprovada: ["em_roteiro", "em_execucao", "aguardando_peca", "concluida", "cancelada"],
  em_roteiro: ["em_execucao", "cliente_ausente", "concluida", "cancelada"],
  em_execucao: [
    "aguardando_aprovacao",
    "aguardando_peca",
    "cliente_ausente",
    "concluida",
    "cancelada",
  ],
  aguardando_peca: ["em_execucao", "concluida", "cancelada"],
  cliente_ausente: ["em_roteiro", "em_analise", "aguardando_aprovacao", "cancelada"],
  concluida: ["entregue", "garantia"],
  entregue: ["garantia"],
  garantia: ["em_analise", "concluida"],
  cancelada: ["aberta"],
};

/** Transições permitidas para técnico (campo) — conclusão e ausente só via check-out formal. */
const TRANSICOES_TECNICO: Partial<Record<StatusOS, StatusOS[]>> = {
  em_roteiro: ["em_execucao"],
  em_execucao: ["aguardando_aprovacao", "aguardando_peca"],
  aguardando_peca: ["em_execucao"],
  aprovada: ["em_execucao", "em_roteiro"],
  aguardando_aprovacao: ["em_roteiro"],
};

/** Transições automáticas do sistema (check-in, check-out, etc.) — não exigem papel. */
const TRANSICOES_SISTEMA: Partial<Record<StatusOS, StatusOS[]>> = {
  em_roteiro: ["em_execucao", "cliente_ausente", "aguardando_aprovacao", "em_analise", "aprovada"],
  em_execucao: ["aguardando_aprovacao", "concluida", "cliente_ausente", "aguardando_peca", "aprovada", "em_analise", "em_roteiro"],
  aguardando_peca: ["em_execucao", "aguardando_aprovacao", "aprovada", "em_analise"],
  aprovada: ["em_execucao", "aguardando_aprovacao", "aguardando_peca", "concluida"],
  em_analise: ["em_execucao", "aguardando_aprovacao", "aguardando_peca"],
  aberta: ["em_execucao", "aguardando_aprovacao", "em_analise", "aprovada"],
  aguardando_aprovacao: ["em_execucao", "aguardando_peca"],
  cliente_ausente: ["em_analise", "aprovada", "aguardando_aprovacao", "em_roteiro"],
  concluida: ["garantia", "entregue"],
  entregue: ["garantia"],
  garantia: ["em_execucao"],
};

/** Status que permitem check-in do técnico na visita. */
export const STATUS_PERMITE_CHECKIN: StatusOS[] = [
  "aberta",
  "em_analise",
  "aprovada",
  "em_roteiro",
  "em_execucao",
  "aguardando_peca",
  "garantia",
];

export function statusPermiteCheckin(status: StatusOS): boolean {
  return STATUS_PERMITE_CHECKIN.includes(status);
}

/** Todos os status — administrador e atendente podem corrigir para qualquer um. */
export const TODOS_STATUS: StatusOS[] = [
  "aberta",
  "em_analise",
  "aguardando_aprovacao",
  "aprovada",
  "em_roteiro",
  "em_execucao",
  "aguardando_peca",
  "cliente_ausente",
  "concluida",
  "entregue",
  "garantia",
  "cancelada",
];

export function transicoesPermitidas(de: StatusOS, papel: Papel): StatusOS[] {
  if (papel === "tecnico") return TRANSICOES_TECNICO[de] ?? [];
  // Operação (admin/atendente): fluxo sugerido primeiro, depois qualquer outro (correção)
  const sugeridas = TRANSICOES_OPERACAO[de] ?? [];
  return [...sugeridas, ...TODOS_STATUS.filter((s) => s !== de && !sugeridas.includes(s))];
}

/** Próximos status do fluxo normal (para destacar na tela). */
export function transicoesSugeridas(de: StatusOS): StatusOS[] {
  return TRANSICOES_OPERACAO[de] ?? [];
}

/** O que acontece ao mudar de status — exibido antes de confirmar. */
export function efeitosMudancaStatus(de: StatusOS, para: StatusOS, aprovado: boolean): string[] {
  const fechados: StatusOS[] = ["concluida", "entregue"];
  const r: string[] = [];
  if (para === "aprovada" && !aprovado) r.push("Marca o orçamento como aprovado e gera a receita a receber no financeiro.");
  if (fechados.includes(para) && !fechados.includes(de)) {
    r.push("Lança (ou atualiza) a receita no financeiro e o serviço passa a contar no faturamento do mês.");
  }
  if (fechados.includes(de) && !fechados.includes(para) && para !== "cancelada" && para !== "garantia") {
    r.push("A OS volta a ficar em aberto e sai do faturamento até ser concluída de novo. Pagamentos já recebidos são mantidos.");
  }
  if (para === "cancelada") r.push("Cancela receitas sem pagamento e as visitas pendentes. Pagamentos já recebidos são mantidos.");
  if (de === "cancelada" && para !== "cancelada") {
    r.push(aprovado ? "Reabre a OS e a receita volta a ficar a receber (sem duplicar)." : "Reabre a OS.");
  }
  if (para === "entregue") r.push("Marca o aparelho como devolvido ao cliente.");
  return r;
}

export function validarTransicaoStatus(
  de: StatusOS,
  para: StatusOS,
  papel: Papel,
  opts?: { sistema?: boolean }
): void {
  if (de === para) return;

  const permitidas = opts?.sistema
    ? TRANSICOES_SISTEMA[de] ?? []
    : transicoesPermitidas(de, papel);

  if (!permitidas.includes(para)) {
    const deLabel = STATUS_OS_LABEL[de] ?? de;
    const paraLabel = STATUS_OS_LABEL[para] ?? para;
    throw new Error(`Não é permitido alterar de "${deLabel}" para "${paraLabel}".`);
  }
}

/** Resultado informado pelo técnico no check-out. */
export type CheckoutResultado = "visita" | "servico_concluido" | "aguardando_peca" | "coletado_oficina";

/** Status após check-out de visita domicílio. */
export function statusPosCheckout(
  os: {
    status: StatusOS;
    aprovado: boolean;
    tipo_atendimento: string;
  },
  resultado: CheckoutResultado = "visita"
): StatusOS | null {
  if (os.tipo_atendimento !== "domicilio") return null;
  if (os.status !== "em_execucao") return null;

  switch (resultado) {
    case "coletado_oficina":
      // Status e local são definidos pela etapa "Coletado para a oficina"
      return null;
    case "aguardando_peca":
      // Sem orçamento aprovado: aguarda aprovação do cliente (peça entra no orçamento).
      // Com aprovação: pedido de peça no fornecedor.
      return os.aprovado ? "aguardando_peca" : "aguardando_aprovacao";
    case "servico_concluido":
      return os.aprovado ? "concluida" : "aguardando_aprovacao";
    case "visita":
    default:
      return os.aprovado ? "aprovada" : "aguardando_aprovacao";
  }
}

export const STATUS_OS_BLOQUEADO_EDICAO: StatusOS[] = ["concluida", "entregue", "cancelada"];
