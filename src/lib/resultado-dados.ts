import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ymdNoFuso } from "@/lib/format";
import { STATUS_OS_ABERTAS } from "@/lib/os-status";
import type { GrupoDre, LancamentoBase, OsBase, TaxaBase } from "@/lib/resultado";

type Sb = SupabaseClient<Database>;

const PAGINA = 1000;
const COLS_LANC =
  "id, tipo, valor, juros, multa, status, origem, descricao, data_competencia, os_id, categorias_financeiras(nome, grupo_dre)";

type LancRow = {
  id: string;
  tipo: "receita" | "despesa";
  valor: number;
  juros: number | null;
  multa: number | null;
  status: string;
  origem: string | null;
  descricao: string;
  data_competencia: string;
  os_id: string | null;
  categorias_financeiras: { nome: string; grupo_dre: string } | null;
};

function paraBase(r: LancRow): LancamentoBase {
  return {
    id: r.id,
    tipo: r.tipo,
    valor: Number(r.valor),
    juros: Number(r.juros || 0),
    multa: Number(r.multa || 0),
    status: r.status,
    origem: r.origem,
    descricao: r.descricao,
    data_competencia: String(r.data_competencia).slice(0, 10),
    os_id: r.os_id,
    categoria: r.categorias_financeiras?.nome ?? null,
    grupo: (r.categorias_financeiras?.grupo_dre as GrupoDre | undefined) ?? null,
  };
}

/** Data de conclusão no fuso de Porto Alegre (coluna pode ser timestamp). */
function dataLocal(v: string | null): string | null {
  if (!v) return null;
  return v.includes("T") ? ymdNoFuso(new Date(v)) : v.slice(0, 10);
}

async function paginar<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const linhas = (data as T[]) || [];
    out.push(...linhas);
    if (linhas.length < PAGINA) break;
  }
  return out;
}

/**
 * Tudo o que é preciso para calcular o resultado de [inicio, fim]:
 * lançamentos por competência, lançamentos das OS concluídas no período,
 * OS abertas com receita (a realizar) e taxas retidas nos recebimentos.
 */
export async function carregarBaseResultado(supabase: Sb, inicio: string, fim: string) {
  // OS concluídas no período (data e hora em Porto Alegre, UTC−3)
  const osConcluidasRaw = await paginar<{ id: string; numero: number; status: string; data_conclusao: string | null }>((de, ate) =>
    supabase
      .from("ordens_servico")
      .select("id, numero, status, data_conclusao")
      .in("status", ["concluida", "entregue"])
      .gte("data_conclusao", `${inicio}T00:00:00-03:00`)
      .lte("data_conclusao", `${fim}T23:59:59.999-03:00`)
      .order("id")
      .range(de, ate)
  );
  const osConcluidas: OsBase[] = osConcluidasRaw.map((o) => ({ ...o, data_conclusao: dataLocal(o.data_conclusao) }));

  const osAbertas = await paginar<OsBase>((de, ate) =>
    supabase
      .from("ordens_servico")
      .select("id, numero, status, data_conclusao")
      .in("status", [...STATUS_OS_ABERTAS])
      .order("id")
      .range(de, ate)
  );

  const porCompetencia = await paginar<LancRow>((de, ate) =>
    supabase
      .from("lancamentos_financeiros")
      .select(COLS_LANC)
      .neq("status", "cancelado")
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim)
      .order("id")
      .range(de, ate)
  );

  // Lançamentos das OS concluídas no período e das OS em aberto (qualquer competência)
  const idsOs = [...osConcluidas.map((o) => o.id), ...osAbertas.map((o) => o.id)];
  const dasOs: LancRow[] = [];
  for (let i = 0; i < idsOs.length; i += 150) {
    const lote = idsOs.slice(i, i + 150);
    dasOs.push(
      ...(await paginar<LancRow>((de, ate) =>
        supabase.from("lancamentos_financeiros").select(COLS_LANC).neq("status", "cancelado").in("os_id", lote).order("id").range(de, ate)
      ))
    );
  }

  const vistos = new Set<string>();
  const lancamentos: LancamentoBase[] = [];
  for (const r of [...porCompetencia, ...dasOs]) {
    if (vistos.has(r.id)) continue;
    vistos.add(r.id);
    lancamentos.push(paraBase(r));
  }

  const taxasRaw = await paginar<{ taxa: number; data_pagamento: string; lancamentos_financeiros: { tipo: string } | null }>((de, ate) =>
    supabase
      .from("os_pagamentos")
      .select("taxa, data_pagamento, lancamentos_financeiros!inner(tipo)")
      .gt("taxa", 0)
      .gte("data_pagamento", inicio)
      .lte("data_pagamento", fim)
      .order("id")
      .range(de, ate)
  );
  const taxas: TaxaBase[] = taxasRaw
    .filter((t) => t.lancamentos_financeiros?.tipo === "receita")
    .map((t) => ({ data: t.data_pagamento, valor: Number(t.taxa) }));

  return { lancamentos, os: [...osConcluidas, ...osAbertas], taxas };
}
