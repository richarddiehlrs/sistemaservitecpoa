import type { StatusOS } from "@/types/database";

export type TipoAtendimento = "domicilio" | "oficina";

export const TIPO_ATENDIMENTO_LABEL: Record<TipoAtendimento, string> = {
  domicilio: "Atendimento a domicílio",
  oficina: "Atendimento na oficina",
};

/** Status exibidos no painel (ativos). */
export const STATUS_PAINEL_ATIVOS: StatusOS[] = [
  "aberta",
  "em_analise",
  "aguardando_aprovacao",
  "aprovada",
  "em_roteiro",
  "em_execucao",
  "aguardando_peca",
  "cliente_ausente",
  "garantia",
];

/** Grupos visuais do painel (cores estilo Prisma). */
export const PAINEL_GRUPOS: {
  key: string;
  label: string;
  statuses: StatusOS[];
  cor: string;
  texto: string;
}[] = [
  { key: "analise", label: "Análise", statuses: ["aberta", "em_analise"], cor: "#2563eb", texto: "#ffffff" },
  { key: "orcamento", label: "Orçamento", statuses: ["aguardando_aprovacao", "aprovada"], cor: "#f59e0b", texto: "#1e293b" },
  { key: "roteiro", label: "Em roteiro / execução", statuses: ["em_roteiro", "em_execucao"], cor: "#7c3aed", texto: "#ffffff" },
  { key: "peca", label: "Aguardando peça", statuses: ["aguardando_peca"], cor: "#dc2626", texto: "#ffffff" },
  { key: "ausente", label: "Cliente ausente", statuses: ["cliente_ausente"], cor: "#e11d48", texto: "#ffffff" },
  { key: "garantia", label: "Garantia", statuses: ["garantia"], cor: "#64748b", texto: "#ffffff" },
  { key: "concluido", label: "Concluído / entregue", statuses: ["concluida", "entregue"], cor: "#16a34a", texto: "#ffffff" },
  { key: "cancelada", label: "Cancelada", statuses: ["cancelada"], cor: "#334155", texto: "#ffffff" },
];

export function corPainelStatus(status: string): { cor: string; texto: string; label: string } {
  const grupo = PAINEL_GRUPOS.find((g) => g.statuses.includes(status as StatusOS));
  if (grupo) return { cor: grupo.cor, texto: grupo.texto, label: grupo.label };
  return { cor: "#94a3b8", texto: "#1e293b", label: status };
}

export function grupoPorStatus(status: string) {
  return PAINEL_GRUPOS.find((g) => g.statuses.includes(status as StatusOS))?.key ?? "outros";
}

/** Grid oficina: 12 linhas × 14 colunas (estilo painel bancada). */
export const OFICINA_GRID_LINHAS = 12;
export const OFICINA_GRID_COLS = 14;
