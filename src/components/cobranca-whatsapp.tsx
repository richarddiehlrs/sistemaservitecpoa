"use client";

import { MessageCircle } from "lucide-react";
import { mensagemCobranca } from "@/lib/whatsapp";
import { WhatsAppEnviar } from "./whatsapp-enviar";

export function CobrancaWhatsApp({
  telefone,
  cliente,
  descricao,
  valor,
  vencimento,
  empresa,
  empresaTelefone,
}: {
  telefone?: string | null;
  cliente?: string | null;
  descricao: string;
  valor: number;
  vencimento?: string | null;
  empresa: string;
  empresaTelefone?: string | null;
}) {
  if (!telefone?.trim()) return null;
  return (
    <WhatsAppEnviar
      telefone={telefone}
      destinatario={cliente}
      titulo="Cobrança pelo WhatsApp"
      mensagem={mensagemCobranca({ cliente, descricao, valor, vencimento, empresa, empresaTelefone })}
      className="rounded p-1.5 text-green-600 hover:bg-green-50"
    >
      <MessageCircle className="h-4 w-4" />
    </WhatsAppEnviar>
  );
}
