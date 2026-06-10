import { STATUS_OS_ABERTAS } from "@/lib/os-status";

/** OS com visita atrasada (exclui cliente ausente — alerta separado). */
export const STATUS_OS_ATRASO = STATUS_OS_ABERTAS.filter((s) => s !== "cliente_ausente");

/** Agenda: ainda não finalizada no dia. */
export const STATUS_AGENDA_PENDENTE = ["agendado", "confirmado", "em_atendimento"] as const;

/** Aviso de vencimento financeiro (dias à frente). */
export const DIAS_AVISO_FINANCEIRO = 3;

export function hojeYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function limiteFinanceiroYmd(dias = DIAS_AVISO_FINANCEIRO): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
