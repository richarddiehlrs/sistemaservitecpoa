"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { obterPosicaoGps } from "@/lib/geo";
import { useToast } from "./toast";
import type { ActionResult } from "@/lib/action-result";

const INTERVALO_MS = 3 * 60 * 1000; // 3 minutos

export function CompartilharGps({
  action,
  emAtendimento = false,
  agendamentoId,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  emAtendimento?: boolean;
  agendamentoId?: string | null;
}) {
  const [ativo, setAtivo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [ultima, setUltima] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const toast = useToast();

  async function enviar() {
    setEnviando(true);
    try {
      const pos = await obterPosicaoGps();
      const fd = new FormData();
      fd.set("lat", String(pos.lat));
      fd.set("lng", String(pos.lng));
      fd.set("precisao", String(pos.precisao));
      fd.set("em_atendimento", emAtendimento ? "1" : "0");
      if (agendamentoId) fd.set("agendamento_id", agendamentoId);
      const res = await action(fd);
      if (!res.ok) {
        toast.push(res.error || "Erro ao enviar localização.", "error");
        setAtivo(false);
        return;
      }
      setUltima(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      toast.push((e as Error).message || "Erro ao enviar localização.", "error");
      setAtivo(false);
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    if (!ativo) {
      clearInterval(timer.current);
      return;
    }
    enviar();
    timer.current = setInterval(enviar, INTERVALO_MS);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, emAtendimento, agendamentoId]);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-800">
            <Navigation className="h-4 w-4 text-brand-600" />
            Compartilhar localização
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Permite que a central veja onde você está no mapa (atualiza a cada 3 min).
          </p>
          {ultima && ativo && (
            <p className="mt-1 text-xs text-green-600">
              <MapPin className="mr-1 inline h-3 w-3" />
              Última atualização: {ultima}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAtivo((a) => !a)}
          disabled={enviando}
          className={ativo ? "btn-secondary text-xs" : "btn-primary text-xs"}
        >
          {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {ativo ? "Parar" : "Ativar GPS"}
        </button>
      </div>
    </div>
  );
}
