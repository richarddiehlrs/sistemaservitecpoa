import { MapPin, Truck, Wrench, UserX, CheckCircle2 } from "lucide-react";
import { formatDate, formatDateTime, STATUS_OS_LABEL, STATUS_OS_COLOR } from "@/lib/format";
import { TURNO_LABEL } from "@/lib/turnos";
import { cn } from "@/lib/utils";

const ETAPAS_VISITA = [
  { key: "aberta", label: "Aberta", icon: CheckCircle2 },
  { key: "em_roteiro", label: "Em roteiro", icon: Truck },
  { key: "em_execucao", label: "Em atendimento", icon: Wrench },
  { key: "concluida", label: "Concluída", icon: CheckCircle2 },
] as const;

export function PortalVisitaStatus({
  status,
  dataPrevisao,
  turno,
  tecnico,
}: {
  status: string;
  dataPrevisao?: string | null;
  turno?: string | null;
  tecnico?: string | null;
}) {
  const ehAusente = status === "cliente_ausente";
  const idxAtual = (() => {
    if (ehAusente || status === "em_execucao") return 2;
    if (["concluida", "entregue"].includes(status)) return 3;
    if (status === "em_roteiro") return 1;
    return 0;
  })();

  return (
    <div className="card mb-4 p-5">
      <h2 className="mb-3 font-semibold text-slate-900">Status da visita</h2>

      {ehAusente ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <UserX className="h-4 w-4 shrink-0" />
          Técnico compareceu, mas o cliente não estava no local.
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between gap-1">
          {ETAPAS_VISITA.map((etapa, i) => {
            const Icon = etapa.icon;
            const ativo = i <= idxAtual;
            const atual = i === idxAtual;
            return (
              <div key={etapa.key} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs",
                    ativo ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-300",
                    atual && "ring-2 ring-brand-200"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn("text-center text-[10px] leading-tight", ativo ? "font-medium text-slate-700" : "text-slate-400")}>
                  {etapa.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Situação atual</dt>
          <dd>
            <span className={cn("badge", STATUS_OS_COLOR[status] || "bg-slate-100 text-slate-600")}>
              {STATUS_OS_LABEL[status] || status}
            </span>
          </dd>
        </div>
        {dataPrevisao && (
          <div>
            <dt className="text-xs text-slate-400">Previsão de visita</dt>
            <dd className="font-medium text-slate-800">
              {formatDate(dataPrevisao)}
              {turno && TURNO_LABEL[turno] ? ` (${TURNO_LABEL[turno]})` : ""}
            </dd>
          </div>
        )}
        {tecnico && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-400">Técnico responsável</dt>
            <dd className="flex items-center gap-1 font-medium text-slate-800">
              <MapPin className="h-3.5 w-3.5 text-slate-400" /> {tecnico}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function PortalTimeline({
  historico,
}: {
  historico: { status: string; observacao?: string | null; created_at: string }[];
}) {
  if (!historico?.length) return null;

  return (
    <div className="card mb-4 p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Acompanhamento</h2>
      <ol className="relative space-y-0 border-l-2 border-brand-100 pl-4">
        {historico.map((h, i) => (
          <li key={i} className="relative pb-4 last:pb-0">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
            <p className="text-xs text-slate-400">{formatDateTime(h.created_at)}</p>
            <p className="font-medium text-slate-800">{STATUS_OS_LABEL[h.status] || h.status}</p>
            {h.observacao && <p className="text-sm text-slate-600">{h.observacao}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
