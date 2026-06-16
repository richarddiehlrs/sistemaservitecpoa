import { ymdLocal } from "@/lib/format";

/** Valor total devido (principal + juros + multa). */
export function valorDevido(l: { valor: number; juros?: number; multa?: number }): number {
  return Number(l.valor) + Number(l.juros || 0) + Number(l.multa || 0);
}

/** Saldo ainda em aberto de um lançamento. */
export function saldoEmAberto(l: {
  valor: number;
  valor_pago?: number;
  juros?: number;
  multa?: number;
}): number {
  return Math.max(0, Math.round((valorDevido(l) - Number(l.valor_pago || 0)) * 100) / 100);
}

/** Início da semana (segunda-feira) em ISO local. */
export function inicioSemanaISO(d: Date): string {
  const x = new Date(d);
  const dia = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dia);
  return ymdLocal(x);
}
/** Label curta da semana: "10 Jun". */
export function labelSemana(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}
