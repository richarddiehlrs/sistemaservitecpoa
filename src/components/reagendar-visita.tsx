"use client";

import { useState } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { amanhaYmdLocal, hojeYmdLocal } from "@/lib/format";
import { MOTIVOS_REAGENDAMENTO, type MotivoReagendamento } from "@/lib/reagendamento";
import { mensagemReagendamento } from "@/lib/mensagens-cliente";
import { telefoneComDDI } from "@/lib/whatsapp";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";
import { WhatsAppEnviar } from "./whatsapp-enviar";

/** Reagendar visita: motivo, nova data/turno e aviso ao cliente pelo WhatsApp. */
export function ReagendarVisita({
  action,
  telefone,
  clienteNome,
  osNumero,
  tecnicoNome,
  empresa,
  empresaTelefone,
  compacto,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  telefone?: string | null;
  clienteNome?: string | null;
  osNumero?: number | null;
  tecnicoNome?: string | null;
  empresa: string;
  empresaTelefone?: string | null;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoReagendamento>("cliente_pediu");
  const [avisar, setAvisar] = useState(true);
  const [whats, setWhats] = useState<{ data: string; turno: string; texto: string } | null>(null);
  const { run, pending } = useAction();
  const temTelefone = Boolean(telefoneComDDI(telefone));

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("motivo", motivo);
    const data = String(fd.get("data"));
    const turno = String(fd.get("turno"));
    run(() => action(fd), {
      successMsg: "Visita reagendada.",
      onSuccess: () => {
        setAberto(false);
        if (avisar && temTelefone && osNumero) setWhats({ data, turno, texto: MOTIVOS_REAGENDAMENTO[motivo].cliente });
      },
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          compacto
            ? "inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
            : "inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
        }
      >
        <CalendarClock className="h-3.5 w-3.5" /> Reagendar
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setAberto(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Reagendar visita</h3>
              <button type="button" onClick={() => setAberto(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={enviar} className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div>
                <p className="label">Motivo</p>
                <div className="grid gap-1.5">
                  {(Object.keys(MOTIVOS_REAGENDAMENTO) as MotivoReagendamento[]).map((m) => (
                    <label
                      key={m}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        motivo === m ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      <input type="radio" name="motivo_radio" checked={motivo === m} onChange={() => setMotivo(m)} />
                      {MOTIVOS_REAGENDAMENTO[m].label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Nova data</label>
                  <input name="data" type="date" min={hojeYmdLocal()} defaultValue={amanhaYmdLocal()} required className="input" />
                </div>
                <div>
                  <label className="label">Turno</label>
                  <select name="turno" className="input" defaultValue="manha">
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="dia">Dia todo</option>
                  </select>
                </div>
              </div>
              <input name="detalhe" className="input" placeholder="Detalhe (opcional, fica no histórico)" />
              <label className={`flex items-center gap-2 text-xs ${temTelefone ? "text-slate-600" : "text-slate-400"}`}>
                <input type="checkbox" checked={avisar && temTelefone} disabled={!temTelefone} onChange={(e) => setAvisar(e.target.checked)} />
                Avisar o cliente pelo WhatsApp {temTelefone ? "(abre a prévia)" : "(cliente sem telefone)"}
              </label>
              <button type="submit" className="btn-primary w-full py-2.5" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar reagendamento
              </button>
            </form>
          </div>
        </div>
      )}

      {whats && osNumero && (
        <WhatsAppEnviar
          telefone={telefone}
          destinatario={clienteNome}
          titulo="Avisar reagendamento"
          mensagem={mensagemReagendamento({
            empresa,
            empresaTelefone,
            cliente: clienteNome,
            numero: osNumero,
            tecnico: tecnicoNome,
            textoMotivo: whats.texto,
            novaData: whats.data,
            turnoNovo: whats.turno,
          })}
          abertoExterno
          onFechar={() => setWhats(null)}
        />
      )}
    </>
  );
}
