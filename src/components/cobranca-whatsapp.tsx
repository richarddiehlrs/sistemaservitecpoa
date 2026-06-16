"use client";

import { MessageCircle } from "lucide-react";
import { linkWhatsApp, mensagemCobranca } from "@/lib/whatsapp";

export function CobrancaWhatsApp({
  telefone,
  cliente,
  descricao,
  valor,
  vencimento,
  empresa,
}: {
  telefone?: string | null;
  cliente?: string | null;
  descricao: string;
  valor: number;
  vencimento?: string | null;
  empresa: string;
}) {
  const href = linkWhatsApp(
    telefone,
    mensagemCobranca({ cliente, descricao, valor, vencimento, empresa })
  );
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded p-1.5 text-green-600 hover:bg-green-50"
      title="Cobrar no WhatsApp"
    >
      <MessageCircle className="h-4 w-4" />
    </a>
  );
}
