"use client";

import { MessageCircle, Mail } from "lucide-react";
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
};

function montarMensagem(p: Props): string {
  const linhas = [
    `*${EMPRESA.nome}*`,
    `Ordem de Serviço: *${formatNumeroOS(p.numero)}*`,
    "",
    p.clienteNome ? `Cliente: ${p.clienteNome}` : "",
    p.equipamento ? `Equipamento: ${p.equipamento}` : "",
    p.defeito ? `Defeito: ${p.defeito}` : "",
    `Status: ${STATUS_OS_LABEL[p.status] || p.status}`,
    `Valor total: ${formatCurrency(p.valorTotal)}`,
    `Garantia: ${p.garantiaDias} dias`,
    "",
    "Qualquer dúvida estamos à disposição.",
    EMPRESA.telefone ? `Contato: ${EMPRESA.telefone}` : "",
  ].filter(Boolean);
  return linhas.join("\n");
}

export function OsShare(props: Props) {
  const mensagem = montarMensagem(props);

  const tel = onlyDigits(props.clienteTelefone || "");
  const telComDDI = tel.length >= 10 ? (tel.startsWith("55") ? tel : `55${tel}`) : "";
  const waUrl = `https://wa.me/${telComDDI}?text=${encodeURIComponent(mensagem)}`;

  const assunto = `${EMPRESA.nome} - ${formatNumeroOS(props.numero)}`;
  const mailUrl = `mailto:${props.clienteEmail || ""}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`btn inline-flex bg-green-600 text-white hover:bg-green-700 ${!telComDDI ? "pointer-events-none opacity-50" : ""}`}
        title={telComDDI ? "Enviar OS por WhatsApp" : "Cliente sem telefone válido"}
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
      <a
        href={mailUrl}
        className={`btn-secondary ${!props.clienteEmail ? "pointer-events-none opacity-50" : ""}`}
        title={props.clienteEmail ? "Enviar OS por e-mail" : "Cliente sem e-mail"}
      >
        <Mail className="h-4 w-4" /> E-mail
      </a>
    </div>
  );
}
