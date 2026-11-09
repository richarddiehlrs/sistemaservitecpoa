"use client";

import { MessageCircle, Mail, Send } from "lucide-react";
import { EMPRESA } from "@/lib/utils";
import { formatNumeroOS } from "@/lib/format";
import { mensagemResumoOs, mensagemStatusOs } from "@/lib/mensagens-cliente";
import { WhatsAppEnviar } from "./whatsapp-enviar";

type Props = {
  numero: number;
  status: string;
  clienteNome?: string | null;
  clienteTelefone?: string | null;
  clienteEmail?: string | null;
  equipamento?: string | null;
  defeito?: string | null;
  valorTotal: number;
  garantiaDias: number;
  previsao?: string | null;
  msgTemplate?: string | null;
  clienteNomeRaw?: string | null;
  empresaNome?: string | null;
  empresaTelefone?: string | null;
  portalUrl?: string | null;
};

export function OsShare(props: Props) {
  const empresa = props.empresaNome || EMPRESA.nome;
  const ctx = {
    empresa,
    empresaTelefone: props.empresaTelefone ?? EMPRESA.telefone,
    cliente: props.clienteNomeRaw || props.clienteNome,
    numero: props.numero,
    status: props.status,
    valorTotal: props.valorTotal,
    portalUrl: props.portalUrl,
    equipamento: props.equipamento,
    garantiaDias: props.garantiaDias,
    msgTemplate: props.msgTemplate,
    defeito: props.defeito,
  };
  const resumo = mensagemResumoOs(ctx);
  const assunto = `${empresa} — Ordem de serviço ${formatNumeroOS(props.numero)}`;
  const mailUrl = `mailto:${props.clienteEmail || ""}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(resumo.replace(/\*/g, ""))}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <WhatsAppEnviar
          telefone={props.clienteTelefone}
          destinatario={props.clienteNome}
          titulo="Enviar resumo da OS"
          mensagem={resumo}
          className="btn inline-flex bg-green-600 text-white hover:bg-green-700"
        >
          <MessageCircle className="h-4 w-4" /> Enviar OS (PDF)
        </WhatsAppEnviar>
        <a
          href={mailUrl}
          className={`btn-secondary ${!props.clienteEmail ? "pointer-events-none opacity-50" : ""}`}
          title={props.clienteEmail ? "Enviar OS por e-mail" : "Cliente sem e-mail"}
        >
          <Mail className="h-4 w-4" /> E-mail
        </a>
      </div>
      <WhatsAppEnviar
        telefone={props.clienteTelefone}
        destinatario={props.clienteNome}
        titulo="Atualização de status"
        mensagem={mensagemStatusOs(ctx)}
        className="btn inline-flex w-full border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
      >
        <Send className="h-4 w-4" /> Avisar status atual no WhatsApp
      </WhatsAppEnviar>
    </div>
  );
}
