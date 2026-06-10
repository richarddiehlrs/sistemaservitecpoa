"use client";

import { MessageCircle, Mail, Send } from "lucide-react";
import { EMPRESA } from "@/lib/utils";
import {
  formatCurrency,
  formatNumeroOS,
  onlyDigits,
  STATUS_OS_LABEL,
} from "@/lib/format";

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
  portalUrl?: string | null;
};

function mensagemCompleta(p: Props): string {
  const empresa = p.empresaNome || EMPRESA.nome;
  const linhas = [
    `*${empresa}*`,
    `Ordem de Serviço: *${formatNumeroOS(p.numero)}*`,
    "",
    p.clienteNome ? `Cliente: ${p.clienteNome}` : "",
    p.equipamento ? `Equipamento: ${p.equipamento}` : "",
    p.defeito ? `Defeito: ${p.defeito}` : "",
    `Status: ${STATUS_OS_LABEL[p.status] || p.status}`,
    `Valor total: ${formatCurrency(p.valorTotal)}`,
    `Garantia: ${p.garantiaDias} dias`,
    "",
    p.portalUrl ? `Acesse e baixe sua OS em PDF:` : "Qualquer dúvida estamos à disposição.",
    p.portalUrl || "",
    "",
    EMPRESA.telefone ? `Contato: ${EMPRESA.telefone}` : "",
  ].filter(Boolean);
  return linhas.join("\n");
}

function mensagemStatus(p: Props): string {
  const tpl =
    p.msgTemplate ||
    'Olá {cliente}! Aqui é da {empresa}. Sobre sua OS {os}: status "{status}". Total: {total}.';
  return tpl
    .replaceAll("{empresa}", p.empresaNome || EMPRESA.nome)
    .replaceAll("{os}", formatNumeroOS(p.numero))
    .replaceAll("{status}", STATUS_OS_LABEL[p.status] || p.status)
    .replaceAll("{cliente}", p.clienteNomeRaw || p.clienteNome || "")
    .replaceAll("{total}", formatCurrency(p.valorTotal));
}

export function OsShare(props: Props) {
  const tel = onlyDigits(props.clienteTelefone || "");
  const telComDDI = tel.length >= 10 ? (tel.startsWith("55") ? tel : `55${tel}`) : "";

  const waCompleta = `https://wa.me/${telComDDI}?text=${encodeURIComponent(mensagemCompleta(props))}`;
  const waStatus = `https://wa.me/${telComDDI}?text=${encodeURIComponent(mensagemStatus(props))}`;

  const assunto = `${props.empresaNome || EMPRESA.nome} - ${formatNumeroOS(props.numero)}`;
  const mailUrl = `mailto:${props.clienteEmail || ""}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagemCompleta(props))}`;

  const semTel = !telComDDI;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a
          href={waCompleta}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn inline-flex bg-green-600 text-white hover:bg-green-700 ${semTel ? "pointer-events-none opacity-50" : ""}`}
          title={semTel ? "Cliente sem telefone válido" : "Enviar OS (com link do PDF) ao cliente"}
        >
          <MessageCircle className="h-4 w-4" /> Enviar OS (PDF)
        </a>
        <a
          href={mailUrl}
          className={`btn-secondary ${!props.clienteEmail ? "pointer-events-none opacity-50" : ""}`}
          title={props.clienteEmail ? "Enviar OS por e-mail" : "Cliente sem e-mail"}
        >
          <Mail className="h-4 w-4" /> E-mail
        </a>
      </div>
      <a
        href={waStatus}
        target="_blank"
        rel="noopener noreferrer"
        className={`btn inline-flex w-full border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 ${semTel ? "pointer-events-none opacity-50" : ""}`}
        title="Enviar mensagem de atualização de status"
      >
        <Send className="h-4 w-4" /> Avisar status atual no WhatsApp
      </a>
    </div>
  );
}
