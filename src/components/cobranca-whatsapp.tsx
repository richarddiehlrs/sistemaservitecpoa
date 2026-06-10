"use client";

import { MessageCircle } from "lucide-react";
import { onlyDigits, formatCurrency, formatDate } from "@/lib/format";

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
  const tel = onlyDigits(telefone || "");
  const ddi = tel.length >= 10 ? (tel.startsWith("55") ? tel : `55${tel}`) : "";
  if (!ddi) return null;

  const msg =
    `Olá ${cliente || ""}! Aqui é da ${empresa}. ` +
    `Identificamos um valor em aberto: ${descricao} — ${formatCurrency(valor)}` +
    (vencimento ? `, com vencimento em ${formatDate(vencimento)}` : "") +
    `. Pode nos enviar o comprovante assim que efetuar o pagamento? Obrigado!`;
  const href = `https://wa.me/${ddi}?text=${encodeURIComponent(msg)}`;

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
