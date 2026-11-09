import { CheckCircle2, Circle } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { ETAPAS, type EtapaOs } from "@/lib/etapas-os";

export type EtapaPortal = { etapa: EtapaOs; observacao: string | null; previsao: string | null; created_at: string };

/** Rastreio do atendimento para o cliente (portal), estilo acompanhamento de encomenda. */
export function PortalLinhaTempo({ etapas }: { etapas: EtapaPortal[] }) {
  if (!etapas.length) return null;
  const lista = [...etapas].reverse();
  return (
    <div className="card mb-4 p-5">
      <h2 className="mb-4 font-semibold text-slate-900">Acompanhe seu atendimento</h2>
      <ol className="relative ml-2 space-y-5 border-l-2 border-slate-200 pl-6">
        {lista.map((e, i) => (
          <li key={`${e.etapa}-${e.created_at}`} className="relative">
            <span className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full bg-white ${i === 0 ? "text-green-600" : "text-slate-300"}`}>
              {i === 0 ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-5 w-5 fill-slate-200" />}
            </span>
            <p className={i === 0 ? "font-semibold text-slate-900" : "font-medium text-slate-600"}>
              {ETAPAS[e.etapa]?.cliente ?? e.etapa}
            </p>
            <p className="text-xs text-slate-400">{formatDateTime(e.created_at)}</p>
            {e.previsao && <p className="mt-0.5 text-sm text-slate-600">Previsão: {formatDate(e.previsao)}</p>}
            {e.observacao && <p className="mt-0.5 text-sm text-slate-600">{e.observacao}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
