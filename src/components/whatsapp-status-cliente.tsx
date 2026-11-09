"use client";

import { MessageCircle } from "lucide-react";
import {
  EVENTOS_WHATSAPP,
  eventosSugeridosParaStatus,
  mensagemWhatsAppCliente,
  type EventoWhatsAppCliente,
} from "@/lib/mensagens-cliente";
import { WhatsAppEnviar } from "./whatsapp-enviar";

type Props = {
  telefone?: string | null;
  clienteNome?: string | null;
  numero: number;
  status: string;
  valorTotal?: number;
  portalUrl?: string | null;
  dataPrevisao?: string | null;
  turno?: string | null;
  horaInicio?: string | null;
  tecnico?: string | null;
  empresaNome: string;
  empresaTelefone?: string | null;
  equipamento?: string | null;
  garantiaDias?: number | null;
  msgTemplate?: string | null;
  destaqueEvento?: EventoWhatsAppCliente | null;
};

export function WhatsAppStatusCliente({
  telefone,
  clienteNome,
  numero,
  status,
  valorTotal,
  portalUrl,
  dataPrevisao,
  turno,
  horaInicio,
  tecnico,
  empresaNome,
  empresaTelefone,
  equipamento,
  garantiaDias,
  msgTemplate,
  destaqueEvento,
}: Props) {
  const ctx = {
    empresa: empresaNome,
    empresaTelefone,
    cliente: clienteNome,
    numero,
    status,
    valorTotal,
    portalUrl,
    dataPrevisao,
    turno,
    horaInicio,
    tecnico,
    equipamento,
    garantiaDias,
    msgTemplate,
  };

  const eventos = eventosSugeridosParaStatus(status);
  const principal = destaqueEvento && eventos.includes(destaqueEvento) ? destaqueEvento : eventos[0];

  if (!telefone?.trim()) {
    return (
      <p id="whatsapp-cliente" className="text-xs text-slate-400">
        Cadastre o telefone do cliente para enviar mensagens pelo WhatsApp.
      </p>
    );
  }

  return (
    <div id="whatsapp-cliente" className="space-y-2 scroll-mt-24">
      <p className="text-xs text-slate-500">Mensagens sugeridas para a etapa atual — revise antes de enviar.</p>
      <div className="flex flex-wrap gap-2">
        {eventos.map((ev) => {
          const meta = EVENTOS_WHATSAPP[ev];
          const destaque = ev === principal;
          return (
            <WhatsAppEnviar
              key={ev}
              telefone={telefone}
              destinatario={clienteNome}
              titulo={meta.label}
              mensagem={mensagemWhatsAppCliente(ev, ctx)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                destaque
                  ? "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {meta.label}
            </WhatsAppEnviar>
          );
        })}
      </div>
    </div>
  );
}
