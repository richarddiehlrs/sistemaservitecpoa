/** Status considerados "em aberto" para o técnico (ainda não finalizados). */
export const STATUS_OS_ABERTAS = [
  "aberta",
  "em_analise",
  "em_roteiro",
  "em_execucao",
  "aguardando_aprovacao",
  "aprovada",
  "aguardando_peca",
  "cliente_ausente",
] as const;

export const PRIORIDADE_ORDEM: Record<string, number> = {
  urgente: 0,
  alta: 1,
  normal: 2,
  baixa: 3,
};

export function ordenarOsPendentes<T extends { prioridade?: string | null; data_previsao?: string | null; data_abertura?: string | null }>(
  lista: T[]
): T[] {
  return [...lista].sort((a, b) => {
    const pa = PRIORIDADE_ORDEM[a.prioridade || "normal"] ?? 2;
    const pb = PRIORIDADE_ORDEM[b.prioridade || "normal"] ?? 2;
    if (pa !== pb) return pa - pb;
    const da = a.data_previsao || a.data_abertura || "";
    const db = b.data_previsao || b.data_abertura || "";
    return da.localeCompare(db);
  });
}
