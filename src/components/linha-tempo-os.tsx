"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Hammer,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Search,
  TestTube2,
  Truck,
  Warehouse,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { ETAPAS, LOCAL_LABEL, type EtapaOs, type LocalEquipamento } from "@/lib/etapas-os";
import { mensagemEtapa, type ContextoMensagemCliente } from "@/lib/mensagens-cliente";
import { telefoneComDDI } from "@/lib/whatsapp";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";
import { WhatsAppEnviar } from "./whatsapp-enviar";

const ICONE: Record<EtapaOs, React.ComponentType<{ className?: string }>> = {
  coletado_oficina: Truck,
  recebido_oficina: Warehouse,
  diagnostico: Search,
  peca_solicitada: Package,
  peca_recebida: PackageCheck,
  reparo_iniciado: Hammer,
  testes: TestTube2,
  pronto: CheckCircle2,
  saiu_entrega: Truck,
  entregue: Flag,
};

export type EtapaRegistrada = {
  id: string;
  etapa: EtapaOs;
  observacao: string | null;
  previsao: string | null;
  created_at: string;
};

export function LinhaTempoOs({
  etapas,
  disponiveis,
  local,
  action,
  telefone,
  ctxMensagem,
  agendarEntrega,
  entregaAgendada,
}: {
  etapas: EtapaRegistrada[];
  disponiveis: EtapaOs[];
  local: LocalEquipamento;
  action: (fd: FormData) => Promise<ActionResult>;
  telefone?: string | null;
  ctxMensagem: ContextoMensagemCliente;
  /** Presente quando o aparelho está pronto na oficina. */
  agendarEntrega?: (fd: FormData) => Promise<ActionResult>;
  entregaAgendada?: string | null;
}) {
  const [escolhida, setEscolhida] = useState<EtapaOs | null>(null);
  const [avisar, setAvisar] = useState(true);
  const [whats, setWhats] = useState<{ etapa: EtapaOs; previsao: string | null; observacao: string | null } | null>(null);
  const { run, pending } = useAction();
  const temTelefone = Boolean(telefoneComDDI(telefone));

  function registrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!escolhida) return;
    const fd = new FormData(e.currentTarget);
    fd.set("etapa", escolhida);
    const previsao = String(fd.get("previsao") || "") || null;
    const observacao = String(fd.get("observacao") || "") || null;
    const etapa = escolhida;
    run(() => action(fd), {
      successMsg: `${ETAPAS[etapa].label} registrado.`,
      onSuccess: () => {
        setEscolhida(null);
        if (avisar && temTelefone) setWhats({ etapa, previsao, observacao });
      },
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Linha do tempo</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          <MapPin className="h-3 w-3" /> {LOCAL_LABEL[local]}
        </span>
      </div>

      {disponiveis.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs text-slate-500">Próxima etapa</p>
          <div className="flex flex-wrap gap-2">
            {disponiveis.map((e, i) => {
              const Icon = ICONE[e];
              const ativo = escolhida === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEscolhida(ativo ? null : e)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    ativo
                      ? "border-brand-600 bg-brand-600 text-white"
                      : i === 0
                        ? "border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ETAPAS[e].label}
                </button>
              );
            })}
          </div>

          {escolhida && (
            <form onSubmit={registrar} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {ETAPAS[escolhida].pedePrevisao && (
                <div>
                  <label className="label text-xs">{escolhida === "peca_solicitada" ? "Previsão de chegada da peça" : "Previsão"}</label>
                  <input name="previsao" type="date" className="input py-1.5 text-sm" />
                </div>
              )}
              <input name="observacao" className="input py-1.5 text-sm" placeholder="Observação (opcional, aparece para o cliente)" />
              <label className={`flex items-center gap-2 text-xs ${temTelefone ? "text-slate-600" : "text-slate-400"}`}>
                <input type="checkbox" checked={avisar && temTelefone} disabled={!temTelefone} onChange={(ev) => setAvisar(ev.target.checked)} />
                Avisar o cliente pelo WhatsApp {temTelefone ? "(abre a prévia)" : "(cliente sem telefone)"}
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary py-1.5 text-sm" onClick={() => setEscolhida(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary py-1.5 text-sm" disabled={pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                  Registrar {ETAPAS[escolhida].label.toLowerCase()}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {agendarEntrega && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
          {entregaAgendada ? (
            <p className="text-sm text-emerald-800">
              Entrega agendada para <strong>{formatDate(entregaAgendada)}</strong>. Ao sair, registre “Saiu para entrega”.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                run(() => agendarEntrega(fd), { successMsg: "Entrega agendada na agenda." });
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <p className="w-full text-sm font-medium text-emerald-900">Aparelho pronto — agendar devolução</p>
              <input name="data" type="date" required className="input w-auto py-1.5 text-sm" />
              <select name="turno" className="input w-auto py-1.5 text-sm" defaultValue="dia">
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="dia">Dia todo</option>
              </select>
              <button className="btn-primary py-1.5 text-sm" disabled={pending}>
                <Truck className="h-4 w-4" /> Agendar entrega
              </button>
            </form>
          )}
        </div>
      )}

      {etapas.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma etapa registrada ainda.</p>
      ) : (
        <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-5">
          {[...etapas].reverse().map((e, i) => {
            const Icon = ICONE[e.etapa];
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
                    i === 0 ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className={`text-sm ${i === 0 ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>{ETAPAS[e.etapa].label}</p>
                <p className="text-xs text-slate-400">{formatDateTime(e.created_at)}</p>
                {e.previsao && <p className="text-xs text-slate-600">Previsão: {formatDate(e.previsao)}</p>}
                {e.observacao && <p className="text-xs text-slate-600">{e.observacao}</p>}
              </li>
            );
          })}
        </ol>
      )}

      {whats && (
        <WhatsAppEnviar
          telefone={telefone}
          destinatario={ctxMensagem.cliente}
          titulo={`Avisar: ${ETAPAS[whats.etapa].label}`}
          mensagem={mensagemEtapa(whats.etapa, { ...ctxMensagem, previsao: whats.previsao, observacao: whats.observacao })}
          abertoExterno
          onFechar={() => setWhats(null)}
        />
      )}
    </div>
  );
}
