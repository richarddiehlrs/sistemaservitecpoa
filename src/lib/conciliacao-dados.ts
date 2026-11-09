import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PagamentoParaConciliar } from "@/lib/conciliacao";

type Sb = SupabaseClient<Database>;

/** Transações pendentes do período + pagamentos ainda não conciliados que podem casar com elas. */
export async function carregarPendencias(supabase: Sb, contaId: string, inicio: string, fim: string) {
  const ini = deslocar(inicio, -35);
  const fimMais = deslocar(fim, 5);
  const [{ data: txRows }, { data: pagRows }] = await Promise.all([
    supabase
      .from("extrato_transacoes")
      .select("id, data, valor, conta_id")
      .eq("conta_id", contaId)
      .eq("status", "pendente")
      .gte("data", inicio)
      .lte("data", fim),
    supabase
      .from("os_pagamentos")
      .select("id, valor, data_pagamento, conta_id, forma_pagamento, observacao, lancamentos_financeiros!inner(tipo, descricao, status)")
      .is("extrato_transacao_id", null)
      .gte("data_pagamento", ini)
      .lte("data_pagamento", fimMais)
      .or(`conta_id.is.null,conta_id.eq.${contaId}`),
  ]);

  const txs = (txRows || []).map((t) => ({ id: t.id, data: t.data, valor: Number(t.valor), contaId: t.conta_id }));
  type PagRow = {
    id: string;
    valor: number;
    data_pagamento: string;
    conta_id: string | null;
    forma_pagamento: string | null;
    lancamentos_financeiros: { tipo: "receita" | "despesa"; descricao: string; status: string } | null;
  };
  const pagamentos: PagamentoParaConciliar[] = ((pagRows || []) as unknown as PagRow[])
    .filter((p) => p.lancamentos_financeiros)
    .map((p) => ({
      id: p.id,
      valor: Number(p.valor),
      data: p.data_pagamento,
      tipoLancamento: p.lancamentos_financeiros!.tipo,
      contaId: p.conta_id,
      descricao: p.lancamentos_financeiros!.descricao,
      forma: p.forma_pagamento,
    }));
  return { txs, pagamentos };
}

export function deslocar(ymd: string, dias: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
