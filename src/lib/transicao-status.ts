import type { Papel } from "@/lib/permissoes";
import { STATUS_OS_LABEL } from "@/lib/format";
import type { StatusOS } from "@/types/database";

/** Transições permitidas para admin e atendente. */
const TRANSICOES_OPERACAO: Partial<Record<StatusOS, StatusOS[]>> = {
  aberta: ["em_analise", "cancelada"],
  em_analise: ["aguardando_aprovacao", "aguardando_peca", "aprovada", "cancelada", "aberta"],
  aguardando_aprovacao: ["aprovada", "em_analise", "cancelada"],
  aprovada: ["em_roteiro", "em_execucao", "aguardando_peca", "cancelada"],
  em_roteiro: ["em_execucao", "cliente_ausente", "cancelada"],
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

/** Transições permitidas para técnico (campo). */
const TRANSICOES_TECNICO: Partial<Record<StatusOS, StatusOS[]>> = {
  em_roteiro: ["em_execucao", "cliente_ausente"],
  em_execucao: ["aguardando_aprovacao", "aguardando_peca", "cliente_ausente"],
  aguardando_peca: ["em_execucao"],
  aprovada: ["em_execucao", "em_roteiro"],
};

/** Transições automáticas do sistema (check-in, check-out, etc.) — não exigem papel. */
const TRANSICOES_SISTEMA: Partial<Record<StatusOS, StatusOS[]>> = {
  em_roteiro: ["em_execucao", "cliente_ausente"],
  em_execucao: ["aguardando_aprovacao", "concluida", "cliente_ausente"],
};

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
    ? TRANSICOES_SISTEMA[de] ?? [para]
    : transicoesPermitidas(de, papel);

  if (!permitidas.includes(para)) {
    const deLabel = STATUS_OS_LABEL[de] ?? de;
    const paraLabel = STATUS_OS_LABEL[para] ?? para;
    throw new Error(`Não é permitido alterar de "${deLabel}" para "${paraLabel}".`);
  }
}

/** Status após check-out de visita domicílio. */
export function statusPosCheckout(os: {
  status: StatusOS;
  aprovado: boolean;
  tipo_atendimento: string;
}): StatusOS | null {
  if (os.tipo_atendimento !== "domicilio") return null;
  if (os.status !== "em_execucao") return null;
  return os.aprovado ? "concluida" : "aguardando_aprovacao";
}

export const STATUS_OS_BLOQUEADO_EDICAO: StatusOS[] = ["concluida", "entregue", "cancelada"];
