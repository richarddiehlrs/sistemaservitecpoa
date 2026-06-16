"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, WifiOff } from "lucide-react";
import { CheckinButtons } from "@/components/checkin-buttons";
import { CampoVisitaAcoes } from "@/components/campo-visita-acoes";
import { formatHora, TIPO_AGENDAMENTO_LABEL } from "@/lib/format";
import type { OsResumoCheckout } from "@/lib/os-valores";

export type VisitaCampoDia = {
  id: string;
  status: string;
  tipo: string;
  titulo: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  endereco: string | null;
  os_id: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_at: string | null;
  checkout_at: string | null;
  clienteNome: string | null;
  clienteTelefone: string | null;
  osNumero: number | null;
  osResumo: OsResumoCheckout | null;
};

type CacheAgenda = {
  savedAt: string;
  visitas: VisitaCampoDia[];
};

function cacheKey(userId: string, hoje: string) {
  return `servitec-campo-agenda-${userId}-${hoje}`;
}

function lerCache(userId: string, hoje: string): CacheAgenda | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId, hoje));
    return raw ? (JSON.parse(raw) as CacheAgenda) : null;
  } catch {
    return null;
  }
}

export function CampoAgendaDia({
  visitas,
  hoje,
  userId,
  tecnicoNome,
  checkinAgendamento,
  checkoutAgendamento,
}: {
  visitas: VisitaCampoDia[];
  hoje: string;
  userId: string;
  tecnicoNome: string;
  checkinAgendamento: (id: string, formData: FormData) => Promise<void>;
  checkoutAgendamento: (id: string, formData?: FormData) => Promise<void>;
}) {
  const [online, setOnline] = useState(true);
  const [cache, setCache] = useState<CacheAgenda | null>(null);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    setCache(lerCache(userId, hoje));

    const onOnline = () => setOnline(true);
    const onOffline = () => {
      setOnline(false);
      setCache(lerCache(userId, hoje));
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [userId, hoje]);

  useEffect(() => {
    if (!visitas.length) return;
    const payload: CacheAgenda = { savedAt: new Date().toISOString(), visitas };
    localStorage.setItem(cacheKey(userId, hoje), JSON.stringify(payload));
    setCache(payload);
  }, [visitas, userId, hoje]);

  const exibir = useMemo(() => {
    if (online) return visitas;
    return cache?.visitas?.length ? cache.visitas : visitas;
  }, [online, visitas, cache]);

  const offlineSemCache = !online && exibir.length === 0;

  return (
    <div className="card mb-6 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Agenda de hoje</h2>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="badge flex items-center gap-1 bg-amber-100 text-amber-800">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
          {online ? (
            <Link href="/agenda" className="text-sm text-brand-600 hover:underline">
              Ver semana
            </Link>
          ) : cache?.savedAt ? (
            <span className="text-xs text-slate-400">
              Salvo {new Date(cache.savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>
      </div>

      {!online && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Sem internet — exibindo a última agenda salva neste aparelho. Check-in e check-out exigem conexão.
        </p>
      )}

      {offlineSemCache ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Sem conexão e nenhuma agenda salva. Abra o Campo com internet pelo menos uma vez hoje.
        </p>
      ) : exibir.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Nenhuma visita pendente para hoje.</p>
      ) : (
        <div className="space-y-3">
          {exibir.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-4 ${
                a.status === "em_atendimento"
                  ? "border-blue-300 bg-blue-50/50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {formatHora(a.hora_inicio)}
                      {a.hora_fim ? `–${formatHora(a.hora_fim)}` : ""}
                    </span>
                    <span className="badge bg-slate-100 text-slate-600 text-[10px]">
                      {TIPO_AGENDAMENTO_LABEL[a.tipo] || a.tipo}
                    </span>
                    {a.status === "em_atendimento" && (
                      <span className="badge bg-blue-100 text-blue-700 text-[10px]">Em atendimento</span>
                    )}
                  </div>
                  <p className="mt-1 font-medium text-slate-800">{a.titulo}</p>
                  {a.clienteNome && <p className="text-sm text-slate-500">{a.clienteNome}</p>}
                  {a.endereco && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-slate-400">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {a.endereco}
                    </p>
                  )}
                  <CampoVisitaAcoes
                    telefone={a.clienteTelefone}
                    endereco={a.endereco}
                    checkinLat={a.checkin_lat}
                    checkinLng={a.checkin_lng}
                    clienteNome={a.clienteNome}
                    tecnicoNome={tecnicoNome}
                    horaInicio={a.hora_inicio}
                    osNumero={a.osNumero}
                  />
                </div>
                {online ? (
                  <CheckinButtons
                    agendamento={a}
                    checkinAction={checkinAgendamento.bind(null, a.id)}
                    checkoutAction={checkoutAgendamento.bind(null, a.id)}
                    permitirRetorno={Boolean(a.os_id)}
                    osResumo={a.osResumo}
                  />
                ) : (
                  <span className="text-[10px] text-slate-400">Check-in offline indisponível</span>
                )}
              </div>
              {a.os_id && (
                <div className="mt-2 flex flex-wrap gap-3">
                  <Link href={`/ordens/${a.os_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                    Abrir ordem →
                  </Link>
                  {online && (
                    <Link
                      href={`/ordens/${a.os_id}/editar`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Editar valores / peças →
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
