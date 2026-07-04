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
  em_roteiro: ["em_execucao", "cliente_ausente", "aguardando_aprovacao"],
  em_execucao: ["aguardando_aprovacao", "concluida", "cliente_ausente", "aguardando_peca", "aprovada"],
  aguardando_peca: ["em_execucao", "aguardando_aprovacao"],
  aprovada: ["em_execucao", "aguardando_aprovacao"],
  em_analise: ["em_execucao", "aguardando_aprovacao"],
  aberta: ["em_execucao", "aguardando_aprovacao"],
  aguardando_aprovacao: ["em_execucao"],
  concluida: ["garantia"],
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

export function transicoesPermitidas(de: StatusOS, papel: Papel): StatusOS[] {
  const mapa = papel === "tecnico" ? TRANSICOES_TECNICO : TRANSICOES_OPERACAO;
  return mapa[de] ?? [];
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
export type CheckoutResultado = "visita" | "servico_concluido" | "aguardando_peca";

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
