import type { SupabaseClient } from "@supabase/supabase-js";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { hojeYmdLocal } from "@/lib/format";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

type ReceitaOsRow = {
  id: string;
  valor: number;
  valor_pago: number | null;
  status: string;
  descricao: string | null;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
};

/** Status da receita conforme valor devido vs. já recebido. */
export function statusReceitaComPagamento(
  valor: number,
  valorPago: number
): "pendente" | "parcial" | "pago" {
  const pago = Math.round(Number(valorPago) * 100) / 100;
  const devido = Math.round(Number(valor) * 100) / 100;
  if (pago <= 0) return "pendente";
  if (pago + 0.001 >= devido) return "pago";
  return "parcial";
}

async function buscarReceitaAtivaOs(supabase: Db, osId: string): Promise<ReceitaOsRow | null> {
  const { data } = await supabase
    .from("lancamentos_financeiros")
    .select("id, valor, valor_pago, status, descricao, forma_pagamento, data_pagamento, observacoes")
    .eq("os_id", osId)
    .eq("tipo", "receita")
    .neq("status", "cancelado")
    .maybeSingle();
  return data;
}

async function buscarCategoriasFinanceiras(supabase: Db) {
  const [{ data: catReceita }, { data: catCusto }] = await Promise.all([
    supabase
      .from("categorias_financeiras")
      .select("id")
      .eq("nome", "Serviços de assistência técnica")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("categorias_financeiras")
      .select("id")
      .eq("nome", "Compra de peças")
      .limit(1)
      .maybeSingle(),
  ]);
  return { catReceita, catCusto };
}

async function inserirCustoOsSeNecessario(
  supabase: Db,
  osId: string,
  clienteId: string,
  numero: number,
  custoTotal: number,
  catCustoId: string | null
): Promise<void> {
  if (custoTotal <= 0) return;

  const { count } = await supabase
    .from("lancamentos_financeiros")
    .select("id", { count: "exact", head: true })
    .eq("os_id", osId)
    .eq("tipo", "despesa")
    .like("descricao", "Custo OS-%")
    .neq("status", "cancelado");

  if ((count ?? 0) > 0) return;

  const hoje = hojeYmdLocal();
  const numeroFmt = `OS-${String(numero).padStart(5, "0")}`;
  await supabase.from("lancamentos_financeiros").insert({
    tipo: "despesa",
    descricao: `Custo ${numeroFmt}`,
    categoria_id: catCustoId,
    os_id: osId,
    cliente_id: clienteId,
    valor: custoTotal,
    valor_pago: 0,
    data_competencia: hoje,
    data_vencimento: hoje,
    status: "pendente",
    origem: "sistema",
    observacoes: "Custo de peças — pagar ao fornecedor separadamente",
  });
}

async function atualizarReceitaOs(
  supabase: Db,
  receita: ReceitaOsRow,
  valorReceita: number,
  observacao?: string
): Promise<boolean> {
  const pago = Number(receita.valor_pago) || 0;
  if (pago > 0 && valorReceita + 0.001 < pago) return false;

  const status = statusReceitaComPagamento(valorReceita, pago);
  const hoje = hojeYmdLocal();

  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({
      valor: valorReceita,
      status,
      valor_liquido: status === "pago" ? valorReceita : null,
      data_pagamento: pago > 0 ? receita.data_pagamento || hoje : null,
      ...(observacao ? { observacoes: observacao } : {}),
    })
    .eq("id", receita.id);

  if (error) {
    console.error("[os-financeiro] Erro ao atualizar receita:", error.message);
    return false;
  }
  return true;
}

/** Verifica se já existe receita ativa na OS (despesas de campo não bloqueiam). */
export async function temReceitaAtivaOs(supabase: Db, osId: string): Promise<boolean> {
  const { count } = await supabase
    .from("lancamentos_financeiros")
    .select("id", { count: "exact", head: true })
    .eq("os_id", osId)
    .eq("tipo", "receita")
    .neq("status", "cancelado");
  return (count ?? 0) > 0;
}

/** @deprecated Use temReceitaAtivaOs — mantido para compatibilidade. */
export const temLancamentoAtivoOs = temReceitaAtivaOs;

/** Registra no financeiro a visita técnica recebida no check-out (idempotente). */
export async function registrarReceitaVisitaCheckout(
  supabase: Db,
  osId: string,
  valorVisita: number,
  formaPagamento?: string | null
): Promise<boolean> {
  const visita = Math.round(Number(valorVisita) * 100) / 100;
  if (visita <= 0) return false;

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, numero, cliente_id, forma_pagamento, status")
    .eq("id", osId)
    .single();

  if (!os || os.status === "cancelada") return false;

  const hoje = hojeYmdLocal();
  const numeroFmt = `OS-${String(os.numero).padStart(5, "0")}`;
  const forma = formaPagamento || os.forma_pagamento || null;
  const existente = await buscarReceitaAtivaOs(supabase, osId);

  if (existente) {
    const pagoAtual = Number(existente.valor_pago) || 0;
    if (pagoAtual + 0.001 >= visita) return true;

    const novoPago = Math.max(pagoAtual, visita);
    const valorLinha = Math.max(Number(existente.valor), novoPago);
    const status = statusReceitaComPagamento(valorLinha, novoPago);

    const { error } = await supabase
      .from("lancamentos_financeiros")
      .update({
        valor: valorLinha,
        valor_pago: novoPago,
        valor_liquido: status === "pago" ? valorLinha : null,
        status,
        data_pagamento: hoje,
        forma_pagamento: forma,
        observacoes: "Visita técnica recebida no check-out",
      })
      .eq("id", existente.id);

    if (error) {
      console.error("[os-financeiro] Erro ao registrar visita:", error.message);
      return false;
    }
    return true;
  }

  const { catReceita } = await buscarCategoriasFinanceiras(supabase);

  const { error } = await supabase.from("lancamentos_financeiros").insert({
    tipo: "receita",
    descricao: `Receita ${numeroFmt}`,
    categoria_id: catReceita?.id ?? null,
    os_id: os.id,
    cliente_id: os.cliente_id,
    valor: visita,
    valor_pago: visita,
    valor_liquido: visita,
    data_competencia: hoje,
    data_vencimento: hoje,
    data_pagamento: hoje,
    status: "pago",
    origem: "sistema",
    forma_pagamento: forma,
    observacoes: "Visita técnica recebida no check-out",
  });

  if (error) {
    console.error("[os-financeiro] Erro ao criar receita da visita:", error.message);
    return false;
  }
  return true;
}

/** Cria ou atualiza receita quando o orçamento é aprovado (portal ou ERP). Idempotente. */
export async function criarReceitaPendenteOs(supabase: Db, osId: string): Promise<boolean> {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, cliente_id, status, valor_itens, valor_visita, abater_visita, desconto, acrescimo, valor_total, custo_total, forma_pagamento"
    )
    .eq("id", osId)
    .single();

  if (!os || os.status === "cancelada") return false;

  const valorReceita = calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
  if (valorReceita <= 0) return false;

  const { catReceita, catCusto } = await buscarCategoriasFinanceiras(supabase);
  const existente = await buscarReceitaAtivaOs(supabase, osId);
  const hoje = hojeYmdLocal();
  const numeroFmt = `OS-${String(os.numero).padStart(5, "0")}`;
  const pagoVisita = Number(existente?.valor_pago) || 0;
  const obsReceita =
    pagoVisita > 0
      ? "Orçamento aprovado — saldo em aberto após abatimento da visita paga"
      : "Gerado automaticamente na aprovação do orçamento";

  if (existente) {
    const ok = await atualizarReceitaOs(supabase, existente, valorReceita, obsReceita);
    if (!ok) return false;
    await inserirCustoOsSeNecessario(
      supabase,
      osId,
      os.cliente_id,
      os.numero,
      Number(os.custo_total),
      catCusto?.id ?? null
    );
  } else {
    const linhas: Record<string, unknown>[] = [
      {
        tipo: "receita",
        descricao: `Receita ${numeroFmt}`,
        categoria_id: catReceita?.id ?? null,
        os_id: os.id,
        cliente_id: os.cliente_id,
        valor: valorReceita,
        valor_pago: 0,
        data_competencia: hoje,
        data_vencimento: hoje,
        status: "pendente",
        origem: "sistema",
        forma_pagamento: os.forma_pagamento,
        observacoes: obsReceita,
      },
    ];

    const custo = Number(os.custo_total);
    if (custo > 0) {
      linhas.push({
        tipo: "despesa",
        descricao: `Custo ${numeroFmt}`,
        categoria_id: catCusto?.id ?? null,
        os_id: os.id,
        cliente_id: os.cliente_id,
        valor: custo,
        valor_pago: 0,
        data_competencia: hoje,
        data_vencimento: hoje,
        status: "pendente",
        origem: "sistema",
        observacoes: "Custo de peças — pagar ao fornecedor separadamente",
      });
    }

    const { error } = await supabase.from("lancamentos_financeiros").insert(linhas);
    if (error) {
      console.error("[os-financeiro] Erro ao criar receita pendente:", error.message);
      return false;
    }
  }

  if (valorReceita !== Number(os.valor_total)) {
    await supabase.from("ordens_servico").update({ valor_total: valorReceita }).eq("id", osId);
  }

  return true;
}

/** Sincroniza receita/custo da OS via RPC (ignora RLS — uso no check-out do técnico). */
export async function sincronizarReceitaOsInterno(
  supabase: Db,
  osId: string,
  observacao?: string
): Promise<void> {
  const { data, error } = await supabase.rpc("criar_receita_os_interno", {
    p_os_id: osId,
    p_observacao: observacao ?? null,
  });

  if (error) {
    throw new Error(`Não foi possível atualizar o financeiro: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      "Não foi possível registrar o financeiro da OS. Verifique se há valores no orçamento."
    );
  }
}

/** Cancela receita e custo automáticos pendentes (mantém despesas de campo e quitados). */
export async function cancelarReceitaPendenteOs(supabase: Db, osId: string): Promise<void> {
  const { data: lancamentos } = await supabase
    .from("lancamentos_financeiros")
    .select("id, tipo, descricao, status, origem, valor_pago, valor")
    .eq("os_id", osId)
    .neq("status", "cancelado");

  for (const l of lancamentos || []) {
    if (
      l.tipo === "receita" &&
      l.status === "parcial" &&
      Number(l.valor_pago) > 0
    ) {
      throw new Error(
        "Não é possível alterar o orçamento: há pagamento parcial registrado nesta OS."
      );
    }
  }

  for (const l of lancamentos || []) {
    if (l.origem === "campo") continue;

    if (l.tipo === "receita" && l.status === "pago") {
      const pago = Number(l.valor_pago) || 0;
      const valor = Number(l.valor) || 0;
      if (pago > 0 && Math.abs(pago - valor) < 0.01) continue;
    }

    const custoOs = l.tipo === "despesa" && l.descricao?.startsWith("Custo OS-");
    const receitaPendente = l.tipo === "receita" && ["pendente", "parcial"].includes(l.status);
    if (receitaPendente || (custoOs && l.status === "pendente")) {
      const { error } = await supabase
        .from("lancamentos_financeiros")
        .update({ status: "cancelado" })
        .eq("id", l.id);
      if (error) {
        throw new Error(`Não foi possível atualizar o financeiro da OS: ${error.message}`);
      }
    }
  }
}

/** Cancela lançamentos automáticos vinculados à OS (ex.: OS cancelada). Preserva despesas de campo. */
export async function cancelarLancamentosOs(supabase: Db, osId: string): Promise<void> {
  const { data: lancamentos } = await supabase
    .from("lancamentos_financeiros")
    .select("id, origem, status, tipo, valor, valor_pago")
    .eq("os_id", osId)
    .neq("status", "cancelado");

  const ids = (lancamentos || [])
    .filter((l) => {
      if (l.origem === "campo") return false;
      if (l.status === "pago") {
        if (l.tipo === "receita") {
          const pago = Number(l.valor_pago) || 0;
          const valor = Number(l.valor) || 0;
          return !(pago > 0 && Math.abs(pago - valor) < 0.01);
        }
        return false;
      }
      return true;
    })
    .map((l) => l.id);

  if (!ids.length) return;

  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({ status: "cancelado" })
    .in("id", ids);
  if (error) {
    console.error("[os-financeiro] Erro ao cancelar lançamentos:", error.message);
  }
}

/** Sincroniza valores dos lançamentos ativos quando a OS é editada (somente se aprovada). */
export async function sincronizarFinanceiroOs(
  supabase: Db,
  osId: string,
  valorReceita: number,
  custoTotal: number
): Promise<void> {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select("aprovado")
    .eq("id", osId)
    .maybeSingle();

  if (!os?.aprovado) return;

  const { data: lancamentos } = await supabase
    .from("lancamentos_financeiros")
    .select("id, tipo, descricao, status, valor, valor_pago")
    .eq("os_id", osId)
    .neq("status", "cancelado");

  if (!lancamentos?.length) return;

  const { data: catCusto } = await supabase
    .from("categorias_financeiras")
    .select("id")
    .eq("nome", "Compra de peças")
    .limit(1)
    .maybeSingle();

  for (const l of lancamentos) {
    const despesaProtegida = l.tipo === "despesa" && l.status === "pago";

    if (l.tipo === "receita") {
      const pago = Number(l.valor_pago) || 0;
      const valorAtual = Number(l.valor) || 0;
      const quitada =
        l.status === "pago" && pago + 0.001 >= valorAtual && Math.abs(valorAtual - valorReceita) < 0.01;
      if (quitada) continue;
      if (pago > 0 && valorReceita + 0.001 < pago) continue;

      const status = statusReceitaComPagamento(valorReceita, pago);
      await supabase
        .from("lancamentos_financeiros")
        .update({
          valor: valorReceita,
          status,
          valor_liquido: status === "pago" ? valorReceita : null,
        })
        .eq("id", l.id);
    }

    if (
      l.tipo === "despesa" &&
      l.descricao?.startsWith("Custo OS-") &&
      !despesaProtegida
    ) {
      if (custoTotal <= 0) {
        await supabase.from("lancamentos_financeiros").update({ status: "cancelado" }).eq("id", l.id);
      } else {
        await supabase.from("lancamentos_financeiros").update({ valor: custoTotal }).eq("id", l.id);
      }
    }
  }

  const temCusto = lancamentos.some((l) => l.tipo === "despesa" && l.descricao?.startsWith("Custo OS-"));
  if (!temCusto && custoTotal > 0) {
    const { data: osMeta } = await supabase
      .from("ordens_servico")
      .select("numero, cliente_id")
      .eq("id", osId)
      .single();
    if (osMeta) {
      const numeroFmt = `OS-${String(osMeta.numero).padStart(5, "0")}`;
      const hoje = hojeYmdLocal();
      await supabase.from("lancamentos_financeiros").insert({
        tipo: "despesa",
        descricao: `Custo ${numeroFmt}`,
        categoria_id: catCusto?.id ?? null,
        os_id: osId,
        cliente_id: osMeta.cliente_id,
        valor: custoTotal,
        valor_pago: 0,
        data_competencia: hoje,
        data_vencimento: hoje,
        status: "pendente",
        origem: "sistema",
        observacoes: "Custo sincronizado da OS",
      });
    }
  }
}
