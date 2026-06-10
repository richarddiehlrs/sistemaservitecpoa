export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Valor monetário por extenso (pt-BR). Ex.: 1.234,50 -> "mil duzentos e trinta e quatro reais e cinquenta centavos".
export function valorPorExtenso(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0) * 100) / 100;
  const reais = Math.floor(n);
  const centavos = Math.round((n - reais) * 100);

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
    "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function ate999(num: number): string {
    if (num === 0) return "";
    if (num === 100) return "cem";
    const c = Math.floor(num / 100);
    const resto = num % 100;
    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);
    if (resto > 0) {
      if (resto < 20) partes.push(unidades[resto]);
      else {
        const d = Math.floor(resto / 10);
        const u = resto % 10;
        partes.push(u > 0 ? `${dezenas[d]} e ${unidades[u]}` : dezenas[d]);
      }
    }
    return partes.join(" e ");
  }

  function inteiroExtenso(num: number): string {
    if (num === 0) return "zero";
    const milhoes = Math.floor(num / 1_000_000);
    const milhares = Math.floor((num % 1_000_000) / 1000);
    const resto = num % 1000;
    const partes: string[] = [];
    if (milhoes > 0) partes.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
    if (milhares > 0) partes.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
    if (resto > 0) partes.push(ate999(resto));
    return partes.join(" e ");
  }

  const partes: string[] = [];
  if (reais > 0) partes.push(`${inteiroExtenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  if (centavos > 0) partes.push(`${inteiroExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (partes.length === 0) return "zero reais";
  return partes.join(" e ");
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

// ---- Máscaras progressivas (para digitação ao vivo) ----
export function maskCpfCnpj(value: string): string {
  const v = onlyDigits(value).slice(0, 14);
  if (v.length <= 11) {
    return v
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return v
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskTelefone(value: string): string {
  const v = onlyDigits(value).slice(0, 11);
  if (v.length <= 10) {
    return v.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return v.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function maskCep(value: string): string {
  const v = onlyDigits(value).slice(0, 8);
  return v.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

export const PRIORIDADE_LABEL: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};

export const PRIORIDADE_COLOR: Record<string, string> = {
  urgente: "bg-red-100 text-red-700",
  alta: "bg-orange-100 text-orange-700",
  normal: "bg-slate-100 text-slate-600",
  baixa: "bg-slate-50 text-slate-400",
};

export const STATUS_OS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  em_roteiro: "Em roteiro para atendimento",
  em_execucao: "Em execução",
  aguardando_peca: "Aguardando peça",
  cliente_ausente: "Cliente ausente",
  concluida: "Concluída",
  entregue: "Entregue",
  cancelada: "Cancelada",
  garantia: "Garantia",
};

export function formatHora(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export const TIPO_AGENDAMENTO_LABEL: Record<string, string> = {
  visita: "Visita técnica",
  coleta: "Coleta",
  entrega: "Entrega",
  retorno: "Retorno",
  orcamento: "Orçamento",
  outro: "Outro",
};

export const TIPO_AGENDAMENTO_COLOR: Record<string, string> = {
  visita: "bg-brand-100 text-brand-700 border-brand-300",
  coleta: "bg-purple-100 text-purple-700 border-purple-300",
  entrega: "bg-emerald-100 text-emerald-700 border-emerald-300",
  retorno: "bg-orange-100 text-orange-700 border-orange-300",
  orcamento: "bg-amber-100 text-amber-700 border-amber-300",
  outro: "bg-slate-100 text-slate-700 border-slate-300",
};

export const STATUS_AGENDAMENTO_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em atendimento",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

export const STATUS_OS_COLOR: Record<string, string> = {
  aberta: "bg-blue-100 text-blue-700",
  em_analise: "bg-indigo-100 text-indigo-700",
  aguardando_aprovacao: "bg-amber-100 text-amber-700",
  aprovada: "bg-cyan-100 text-cyan-700",
  em_roteiro: "bg-teal-100 text-teal-700",
  em_execucao: "bg-purple-100 text-purple-700",
  aguardando_peca: "bg-orange-100 text-orange-700",
  cliente_ausente: "bg-rose-100 text-rose-700",
  concluida: "bg-green-100 text-green-700",
  entregue: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-red-100 text-red-700",
  garantia: "bg-slate-100 text-slate-700",
};
