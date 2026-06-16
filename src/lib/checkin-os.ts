import type { StatusOS } from "@/types/database";
import { STATUS_OS_LABEL } from "@/lib/format";
import { statusPermiteCheckin } from "@/lib/transicao-status";

/** Orçamento já enviado ao cliente — check-in exige aprovação (retorno pós-visita). */
export function orcamentoJaEnviado(historicoStatuses: string[]): boolean {
  return historicoStatuses.includes("aguardando_aprovacao");
}

export function checkinBloqueadoPorAprovacao(
  os: { status: StatusOS; aprovado: boolean },
  historicoStatuses: string[]
): boolean {
  if (os.aprovado) return false;
  if (os.status === "aguardando_aprovacao") return true;
  return orcamentoJaEnviado(historicoStatuses);
}

export function mensagemCheckinBloqueado(status?: StatusOS): string {
  if (!status || !statusPermiteCheckin(status)) {
    if (status === "aguardando_aprovacao") {
      return "Esta OS aguarda aprovação do cliente antes de iniciar o atendimento.";
    }
    if (status === "cancelada") {
      return "Esta ordem de serviço foi cancelada.";
    }
    if (["concluida", "entregue"].includes(status)) {
      return "Esta ordem de serviço já foi finalizada.";
    }
    return `Não é possível iniciar atendimento no status "${STATUS_OS_LABEL[status] || status}".`;
  }
  return "Esta OS aguarda aprovação do cliente antes de iniciar o atendimento. Reagende após a aprovação.";
}
