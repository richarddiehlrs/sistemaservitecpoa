import { hojeYmdLocal } from "@/lib/format";
import { STATUS_OS_ABERTAS } from "@/lib/os-status";

/** OS com visita atrasada (exclui cliente ausente — alerta separado). */
export const STATUS_OS_ATRASO = STATUS_OS_ABERTAS.filter((s) => s !== "cliente_ausente");

/** Agenda: ainda não finalizada no dia. */
export const STATUS_AGENDA_PENDENTE = ["agendado", "confirmado", "em_atendimento"] as const;

/** Aviso de vencimento financeiro (dias à frente). */
export const DIAS_AVISO_FINANCEIRO = 3;

/** OS de oficina parada em análise ou aguardando peça (dias). */
export const DIAS_OFICINA_PARADA_PADRAO = 2;

export const STATUS_OFICINA_PARADA = ["em_analise", "aguardando_peca"] as const;

/** Aviso de garantia expirando (dias antes do fim). */
export const DIAS_AVISO_GARANTIA = 15;

/** Meta de faturamento: alerta se realizado < X% da meta no mês. */
export const META_ALERTA_PERCENTUAL = 70;

export function hojeYmd(): string {
  return hojeYmdLocal();
}

export function limiteFinanceiroYmd(dias = DIAS_AVISO_FINANCEIRO): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
