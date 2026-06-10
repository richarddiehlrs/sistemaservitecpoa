export type Turno = "manha" | "tarde" | "dia";

export const TURNOS: Record<Turno, { label: string; inicio: string; fim: string }> = {
  manha: { label: "Manhã", inicio: "09:00", fim: "12:00" },
  tarde: { label: "Tarde", inicio: "13:00", fim: "17:30" },
  dia: { label: "Dia inteiro", inicio: "09:00", fim: "17:30" },
};

export const TURNO_LABEL: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  dia: "Dia inteiro",
};

export function horarioTurno(turno?: string | null): { inicio: string | null; fim: string | null } {
  if (turno && turno in TURNOS) {
    const t = TURNOS[turno as Turno];
    return { inicio: t.inicio, fim: t.fim };
  }
  return { inicio: null, fim: null };
}
