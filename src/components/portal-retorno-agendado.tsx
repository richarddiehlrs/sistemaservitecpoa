import { CalendarClock, MapPin } from "lucide-react";
import { formatDate, formatHora } from "@/lib/format";
import { TURNO_LABEL } from "@/lib/turnos";

type Agendamento = {
  data: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  turno?: string | null;
  status?: string | null;
  endereco?: string | null;
};

export function PortalRetornoAgendado({ agendamento }: { agendamento: Agendamento | null | undefined }) {
  if (!agendamento?.data) return null;

  const turno =
    agendamento.turno && TURNO_LABEL[agendamento.turno]
      ? TURNO_LABEL[agendamento.turno]
      : null;
  const horario =
    agendamento.hora_inicio
      ? `${formatHora(agendamento.hora_inicio)}${
          agendamento.hora_fim ? `–${formatHora(agendamento.hora_fim)}` : ""
        }`
      : null;

  return (
    <div className="card mb-4 border-brand-200 bg-brand-50/50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-brand-900">Próxima visita agendada</h2>
          <p className="mt-1 text-sm text-slate-700">
            <strong>{formatDate(agendamento.data)}</strong>
            {turno && ` • ${turno}`}
            {horario && ` • ${horario}`}
          </p>
          {agendamento.endereco && (
            <p className="mt-2 flex items-start gap-1 text-xs text-slate-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {agendamento.endereco}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            O técnico comparecerá nesta data para continuar ou executar o serviço.
          </p>
        </div>
      </div>
    </div>
  );
}
