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

export type CaixaConta = { id: string; nome: string; saldo: number; configurada: boolean };

/**
 * Caixa atual = saldo de cada conta ativa (saldo inicial + movimentos até hoje).
 * Pagamentos sem conta definida (forma de pagamento vazia) aparecem à parte.
 */
export async function caixaPorConta(
  supabase: SupabaseClient<Database>,
  ate: string
): Promise<{
  contas: CaixaConta[];
  semConta: number;
  total: number;
  configurado: boolean;
  /** Data mais recente em que um saldo de conta foi informado. */
  dataSaldoInformado: string | null;
  /** Todos os saldos informados são zero (provavelmente não preenchidos). */
  saldosZerados: boolean;
}> {
  const { data: contas } = await supabase
    .from("contas_financeiras")
    .select("id, nome, saldo_inicial, data_saldo_inicial")
    .eq("ativo", true)
    .order("nome");

  const lista: CaixaConta[] = [];
  for (const c of contas || []) {
    lista.push({
      id: c.id,
      nome: c.nome,
      saldo: await saldoSistemaConta(supabase, c, ate),
      configurada: c.data_saldo_inicial != null,
    });
  }

  // Saldo real só existe quando todas as contas têm saldo inicial (extrato) numa data.
  // Pagamentos até essa data já estão dentro do saldo informado; só contam os posteriores.
  const configurado = lista.length > 0 && lista.every((c) => c.configurada);
  const corte = (contas || [])
    .map((c) => c.data_saldo_inicial)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  // Pagamentos sem conta: não dá para saber onde o dinheiro está
  type Row = { valor: number; taxa: number; lancamentos_financeiros: { tipo: "receita" | "despesa" } | null };
  let semConta = 0;
  for (let de = 0; ; de += 1000) {
    let q = supabase
      .from("os_pagamentos")
      .select("valor, taxa, lancamentos_financeiros!inner(tipo)")
      .is("conta_id", null)
      .lte("data_pagamento", ate)
      .order("id")
      .range(de, de + 999);
    if (corte) q = q.gt("data_pagamento", corte);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const r of (data || []) as unknown as Row[]) {
      semConta += r.lancamentos_financeiros?.tipo === "despesa" ? -Number(r.valor) : Number(r.valor) - Number(r.taxa || 0);
    }
    if (!data || data.length < 1000) break;
  }
  semConta = Math.round(semConta * 100) / 100;

  const total = Math.round((lista.reduce((s, c) => s + c.saldo, 0) + semConta) * 100) / 100;
  const datas = (contas || []).map((c) => c.data_saldo_inicial).filter((d): d is string => Boolean(d)).sort();
  const saldosZerados = (contas || []).every((c) => Number(c.saldo_inicial || 0) === 0);
  return {
    contas: lista,
    semConta,
    total,
    configurado,
    dataSaldoInformado: datas.length ? datas[datas.length - 1] : null,
    saldosZerados,
  };
}
