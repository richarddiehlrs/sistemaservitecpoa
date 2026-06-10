"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Loader2, MapPin, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumeroOS, PRIORIDADE_COLOR, PRIORIDADE_LABEL, STATUS_OS_LABEL } from "@/lib/format";
import { STATUS_OS_ABERTAS, ordenarOsPendentes } from "@/lib/os-status";

type OsPendente = {
  id: string;
  numero: number;
  status: string;
  prioridade: string | null;
  data_previsao: string | null;
  data_abertura: string;
  defeito_relatado: string | null;
  turno: string | null;
  clientes: { nome: string; cidade: string | null; bairro: string | null } | null;
};

export function TecnicoCargaTrabalho({ tecnicoId }: { tecnicoId: string }) {
  const [lista, setLista] = useState<OsPendente[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!tecnicoId) {
      setLista([]);
      return;
    }

    let ativo = true;
    setCarregando(true);

    const supabase = createClient();
    supabase
      .from("ordens_servico")
      .select("id, numero, status, prioridade, data_previsao, data_abertura, defeito_relatado, turno, clientes(nome, cidade, bairro)")
      .eq("tecnico_id", tecnicoId)
      .in("status", [...STATUS_OS_ABERTAS])
      .order("data_abertura", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          setLista([]);
        } else {
          setLista(ordenarOsPendentes((data || []) as OsPendente[]));
        }
        setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [tecnicoId]);

  if (!tecnicoId) return null;

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-brand-800">
          <Wrench className="h-4 w-4" />
          Ordens pendentes deste técnico
        </h4>
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-brand-500" />}
      </div>

      {!carregando && lista.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma ordem pendente — carga de trabalho livre.</p>
      )}

      {lista.length > 0 && (
        <>
          <p className="mb-3 text-xs text-slate-500">
            {lista.length} ordem(ns) em andamento. Verifique a agenda antes de atribuir nova visita.
          </p>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {lista.map((o) => {
              const prioridade = o.prioridade || "normal";
              const local = [o.clientes?.bairro, o.clientes?.cidade].filter(Boolean).join(" — ");
              return (
                <div
                  key={o.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white bg-white px-3 py-2 text-sm shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/ordens/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                        {formatNumeroOS(o.numero)}
                      </Link>
                      <span className={`badge text-[10px] ${PRIORIDADE_COLOR[prioridade] || "bg-slate-100 text-slate-600"}`}>
                        {PRIORIDADE_LABEL[prioridade] || prioridade}
                      </span>
                      <span className="text-xs text-slate-500">{STATUS_OS_LABEL[o.status] || o.status}</span>
                    </div>
                    <p className="truncate font-medium text-slate-800">{o.clientes?.nome || "—"}</p>
                    {o.defeito_relatado && (
                      <p className="truncate text-xs text-slate-500">{o.defeito_relatado}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                      {o.data_previsao && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(o.data_previsao)}
                          {o.turno && ` (${o.turno})`}
                        </span>
                      )}
                      {local && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {local}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
