import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { formatDate, formatNumeroOS, PRIORIDADE_COLOR, PRIORIDADE_LABEL } from "@/lib/format";

export type OsPendenteItem = {
  id: string;
  numero: number;
  status: string;
  prioridade: string | null;
  data_previsao: string | null;
  data_abertura: string;
  defeito_relatado: string | null;
  turno: string | null;
  clientes: { nome: string; bairro: string | null; cidade: string | null } | null;
};

export function OsPendentesLista({ lista, titulo }: { lista: OsPendenteItem[]; titulo?: string }) {
  if (lista.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        Nenhuma ordem pendente no momento.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {titulo && (
        <p className="mb-1 text-xs text-slate-500">{titulo}</p>
      )}
      {lista.map((o) => {
        const prioridade = o.prioridade || "normal";
        const local = [o.clientes?.bairro, o.clientes?.cidade].filter(Boolean).join(" — ");
        return (
          <Link
            key={o.id}
            href={`/ordens/${o.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-brand-700">{formatNumeroOS(o.numero)}</span>
                  <span className={`badge text-[10px] ${PRIORIDADE_COLOR[prioridade] || ""}`}>
                    {PRIORIDADE_LABEL[prioridade] || prioridade}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 font-semibold text-slate-800">{o.clientes?.nome || "—"}</p>
                {o.defeito_relatado && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{o.defeito_relatado}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  {o.data_previsao ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Visita: {formatDate(o.data_previsao)}
                      {o.turno && ` (${o.turno})`}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Aberta em {formatDate(o.data_abertura)}
                    </span>
                  )}
                  {local && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {local}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-medium text-brand-600">Abrir →</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
