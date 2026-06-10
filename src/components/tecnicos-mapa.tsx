import Link from "next/link";
import { MapPin, Navigation } from "lucide-react";
import { linkMapa, formatCoordenadas } from "@/lib/geo";
import { formatDateTime } from "@/lib/format";

export type PosicaoTecnico = {
  user_id: string;
  tecnico_nome: string | null;
  lat: number;
  lng: number;
  precisao: number | null;
  em_atendimento: boolean;
  atualizado_at: string;
};

export function TecnicosMapa({ posicoes }: { posicoes: PosicaoTecnico[] }) {
  if (posicoes.length === 0) return null;

  return (
    <div className="card mb-6 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
        <Navigation className="h-5 w-5 text-brand-600" />
        Técnicos no mapa
        <span className="text-xs font-normal text-slate-400">({posicoes.length} online)</span>
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {posicoes.map((p) => (
          <div key={p.user_id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{p.tecnico_nome || "Técnico"}</p>
              <p className="text-[11px] text-slate-400">
                {formatCoordenadas(Number(p.lat), Number(p.lng))}
                {p.em_atendimento && (
                  <span className="ml-1 font-semibold text-green-600">• Em atendimento</span>
                )}
              </p>
              <p className="text-[10px] text-slate-400">{formatDateTime(p.atualizado_at)}</p>
            </div>
            <Link
              href={linkMapa(Number(p.lat), Number(p.lng))}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary shrink-0 px-2 py-1.5 text-xs"
            >
              <MapPin className="h-3.5 w-3.5" />
              Mapa
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LinkMapaCheckin({
  lat,
  lng,
  label = "Ver check-in no mapa",
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  label?: string;
}) {
  if (lat == null || lng == null) return null;
  return (
    <Link
      href={linkMapa(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"
    >
      <MapPin className="h-3 w-3" />
      {label}
    </Link>
  );
}
