import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContaFinanceira, Database } from "@/types/database";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-11" → { inicio: "2026-11-01", fim: "2026-11-30", label: "novembro de 2026" } (sem fuso). */
export function periodoMes(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return {
    inicio: `${ano}-${mm}-01`,
    fim: `${ano}-${mm}-${String(ultimo).padStart(2, "0")}`,
    label: `${MESES[m - 1]} de ${ano}`,
  };
}

/**
 * Saldo da conta segundo o sistema até uma data:
 * saldo inicial cadastrado + recebimentos − pagamentos lançados nesta conta.
 * Pagamentos de lançamento cancelado continuam contando (o dinheiro se moveu).
 */
export async function saldoSistemaConta(
  supabase: SupabaseClient<Database>,
  conta: Pick<ContaFinanceira, "id" | "saldo_inicial" | "data_saldo_inicial">,
  ate: string
): Promise<number> {
  type Row = { valor: number; taxa: number; lancamentos_financeiros: { tipo: "receita" | "despesa" } | null };
  let saldo = Number(conta.saldo_inicial || 0);
  const PAGINA = 1000; // limite padrão do Supabase por consulta

  for (let de = 0; ; de += PAGINA) {
    let q = supabase
      .from("os_pagamentos")
      .select("valor, taxa, lancamentos_financeiros!inner(tipo)")
      .eq("conta_id", conta.id)
      .lte("data_pagamento", ate)
      .order("id")
      .range(de, de + PAGINA - 1);
    if (conta.data_saldo_inicial) q = q.gt("data_pagamento", conta.data_saldo_inicial);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const r of (data || []) as unknown as Row[]) {
      // taxa retida (maquininha) nunca entra na conta
      saldo += r.lancamentos_financeiros?.tipo === "despesa" ? -Number(r.valor) : Number(r.valor) - Number(r.taxa || 0);
    }
    if (!data || data.length < PAGINA) break;
  }
  return Math.round(saldo * 100) / 100;
}
