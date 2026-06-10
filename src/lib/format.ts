export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumeroOS(numero: number): string {
  return `OS-${String(numero).padStart(5, "0")}`;
}

export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export function formatCpfCnpj(value: string | null | undefined): string {
  const v = onlyDigits(value || "");
  if (v.length === 11) {
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (v.length === 14) {
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value || "";
}

export function formatCep(value: string | null | undefined): string {
  const v = onlyDigits(value || "");
  if (v.length === 8) return v.replace(/(\d{5})(\d{3})/, "$1-$2");
  return value || "";
}

export function formatTelefone(value: string | null | undefined): string {
  const v = onlyDigits(value || "");
  if (v.length === 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (v.length === 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return value || "";
}

export const STATUS_OS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  em_execucao: "Em execução",
  aguardando_peca: "Aguardando peça",
  concluida: "Concluída",
  entregue: "Entregue",
  cancelada: "Cancelada",
  garantia: "Garantia",
};

export const STATUS_OS_COLOR: Record<string, string> = {
  aberta: "bg-blue-100 text-blue-700",
  em_analise: "bg-indigo-100 text-indigo-700",
  aguardando_aprovacao: "bg-amber-100 text-amber-700",
  aprovada: "bg-cyan-100 text-cyan-700",
  em_execucao: "bg-purple-100 text-purple-700",
  aguardando_peca: "bg-orange-100 text-orange-700",
  concluida: "bg-green-100 text-green-700",
  entregue: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-red-100 text-red-700",
  garantia: "bg-slate-100 text-slate-700",
};
