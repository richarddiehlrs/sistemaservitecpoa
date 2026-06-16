import type { StatusOS } from "@/types/database";
import { STATUS_OS_LABEL } from "@/lib/format";
import { statusPermiteCheckin } from "@/lib/transicao-status";

/** Orçamento já enviado ao cliente — retorno exige aprovação. */
export function orcamentoJaEnviado(historicoStatuses: string[]): boolean {
  return historicoStatuses.includes("aguardando_aprovacao");
}

/** Primeira visita = ainda não houve check-out concluído nesta OS. */
export function ehPrimeiraVisitaOs(visitasRealizadas: number): boolean {
  return visitasRealizadas <= 0;
}

/** Status da OS que permitem check-in (considera 1ª visita com orçamento já enviado). */
export function statusPermiteCheckinOs(status: StatusOS, visitasRealizadas: number): boolean {
  if (statusPermiteCheckin(status)) return true;
  if (status === "aguardando_aprovacao" && ehPrimeiraVisitaOs(visitasRealizadas)) return true;
  return false;
}

export function checkinBloqueadoPorAprovacao(
  os: { status: StatusOS; aprovado: boolean },
  historicoStatuses: string[],
  visitasRealizadas = 0
): boolean {
  if (os.aprovado) return false;
  // 1ª visita: técnico pode ir diagnosticar mesmo com orçamento enviado antes da ida
  if (ehPrimeiraVisitaOs(visitasRealizadas)) return false;
  if (os.status === "aguardando_aprovacao") return true;
  return orcamentoJaEnviado(historicoStatuses);
}

export type ResultadoCheckinOs = { ok: true } | { ok: false; motivo: string };

export function validarCheckinOs(
  os: { status: StatusOS; aprovado: boolean },
  historicoStatuses: string[],
  visitasRealizadas: number
): ResultadoCheckinOs {
  if (!statusPermiteCheckinOs(os.status, visitasRealizadas)) {
    return { ok: false, motivo: mensagemCheckinBloqueado(os.status, visitasRealizadas) };
  }
  if (checkinBloqueadoPorAprovacao(os, historicoStatuses, visitasRealizadas)) {
    return {
      ok: false,
      motivo:
        "Esta OS aguarda aprovação do cliente antes do retorno. Aprove o orçamento no ERP ou peça ao cliente no portal.",
    };
  }
  return { ok: true };
}

export function mensagemCheckinBloqueado(status?: StatusOS, visitasRealizadas = 0): string {
  if (status === "aguardando_aprovacao") {
    if (ehPrimeiraVisitaOs(visitasRealizadas)) {
      return "Esta OS aguarda aprovação do cliente antes de iniciar o atendimento.";
    }
    return "Esta OS aguarda aprovação do cliente antes do retorno. Aprove o orçamento e reagende.";
  }
  if (!status || !statusPermiteCheckin(status)) {
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
