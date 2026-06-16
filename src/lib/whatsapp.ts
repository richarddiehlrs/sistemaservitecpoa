import { formatCurrency, formatDate, onlyDigits } from "@/lib/format";

export function telefoneComDDI(telefone: string | null | undefined): string {
  const tel = onlyDigits(telefone || "");
  if (tel.length < 10) return "";
  return tel.startsWith("55") ? tel : `55${tel}`;
}

export function linkWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  const ddi = telefoneComDDI(telefone);
  return ddi ? `https://wa.me/${ddi}?text=${encodeURIComponent(texto)}` : null;
}

export function mensagemCobranca({
  cliente,
  descricao,
  valor,
  vencimento,
  empresa,
}: {
  cliente?: string | null;
  descricao: string;
  valor: number;
  vencimento?: string | null;
  empresa: string;
}): string {
  return (
    `Olá ${cliente || ""}! Aqui é da ${empresa}. ` +
    `Identificamos um valor em aberto: ${descricao} — ${formatCurrency(valor)}` +
    (vencimento ? `, com vencimento em ${formatDate(vencimento)}` : "") +
    `. Pode nos enviar o comprovante assim que efetuar o pagamento? Obrigado!`
  );
}
