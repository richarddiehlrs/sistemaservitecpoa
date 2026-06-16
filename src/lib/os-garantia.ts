import { calcValorTotalCliente } from "@/lib/os-valores";
import type { OrdemServico, StatusOS } from "@/types/database";

export type MotivoAtendimentoOs = "normal" | "retorno_garantia";

export function isRetornoGarantia(os: { motivo_atendimento?: string | null }): boolean {
  return os.motivo_atendimento === "retorno_garantia";
}

/** Data limite da garantia (data_conclusao + dias). */
export function dataFimGarantiaOs(os: {
  data_conclusao: string | null;
  garantia_dias: number;
}): Date | null {
  if (!os.data_conclusao) return null;
  const base = new Date(os.data_conclusao);
  if (Number.isNaN(base.getTime())) return null;
  const fim = new Date(base);
  fim.setDate(fim.getDate() + Math.max(0, Number(os.garantia_dias) || 0));
  return fim;
}

export function osDentroGarantia(os: {
  data_conclusao: string | null;
  garantia_dias: number;
}): boolean {
  const fim = dataFimGarantiaOs(os);
  if (!fim) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  fim.setHours(23, 59, 59, 999);
  return hoje <= fim;
}

const STATUS_ORIGEM_RETORNO: StatusOS[] = ["concluida", "entregue", "garantia"];

export function podeAbrirRetornoGarantia(os: OrdemServico & { motivo_atendimento?: string | null }): {
  ok: boolean;
  motivo?: string;
} {
  if (isRetornoGarantia(os)) {
    return { ok: false, motivo: "Esta OS já é um retorno em garantia." };
  }
  if (!STATUS_ORIGEM_RETORNO.includes(os.status)) {
    return { ok: false, motivo: "Só é possível abrir retorno em OS concluída, entregue ou em garantia." };
  }
  if (!osDentroGarantia(os)) {
    return { ok: false, motivo: "Prazo de garantia expirado." };
  }
  return { ok: true };
}

/** Total cobrado do cliente no retorno (0 = garantia sem cobrança). */
export function valorCobrancaRetornoGarantia(os: {
  valor_itens: number;
  valor_visita: number;
  abater_visita: boolean;
  desconto: number;
  acrescimo: number;
}): number {
  return calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
}

export type PrejuizoGarantiaResumo = {
  custo: number;
  receitaPaga: number;
  prejuizo: number;
  osIds: string[];
};

/** Prejuízo = custos do retorno − o que o cliente pagou (geralmente zero). */
export function calcPrejuizoGarantiaPeriodo(
  lancamentos: Array<{
    os_id?: string | null;
    tipo: "receita" | "despesa";
    valor: number;
    valor_pago?: number | null;
    status?: string | null;
    categorias_financeiras?: { grupo_dre?: string | null } | null;
  }>,
  osRetornoIds: Set<string>
): PrejuizoGarantiaResumo {
  let custo = 0;
  let receitaPaga = 0;
  const osIds = new Set<string>();

  for (const l of lancamentos) {
    if (l.status === "cancelado" || !l.os_id || !osRetornoIds.has(l.os_id)) continue;
    osIds.add(l.os_id);
    if (l.tipo === "despesa") {
      const g = l.categorias_financeiras?.grupo_dre;
      if (g === "custo_garantia" || g === "custo_pecas") {
        custo += Number(l.valor);
      }
    }
    if (l.tipo === "receita") {
      receitaPaga += Number(l.valor_pago) || 0;
    }
  }

  custo = Math.round(custo * 100) / 100;
  receitaPaga = Math.round(receitaPaga * 100) / 100;
  const prejuizo = Math.round(Math.max(0, custo - receitaPaga) * 100) / 100;

  return { custo, receitaPaga, prejuizo, osIds: [...osIds] };
}
