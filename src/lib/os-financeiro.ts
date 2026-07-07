import type { SupabaseClient } from "@supabase/supabase-js";
import { calcReceitaFaturamentoOs, calcValorTotalCliente } from "@/lib/os-valores";
import { hojeYmdLocal } from "@/lib/format";
import { isRetornoGarantia } from "@/lib/os-garantia";
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
    const { registrarHistoricoVisitaOs } = await import("@/lib/os-pagamentos");
    await registrarHistoricoVisitaOs(supabase, osId, visita, forma);
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

  const { registrarHistoricoVisitaOs } = await import("@/lib/os-pagamentos");
  await registrarHistoricoVisitaOs(supabase, osId, visita, forma);
  return true;
}

/** Cria ou atualiza receita quando o orçamento é aprovado (portal ou ERP). Idempotente. */
export async function criarReceitaPendenteOs(supabase: Db, osId: string): Promise<boolean> {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, cliente_id, status, valor_itens, valor_visita, abater_visita, desconto, acrescimo, valor_total, custo_total, forma_pagamento, motivo_atendimento"
    )
    .eq("id", osId)
    .single();

  if (!os || os.status === "cancelada") return false;
  if ((os as { motivo_atendimento?: string }).motivo_atendimento === "retorno_garantia") {
    return false;
  }

  const valorFaturamento = calcReceitaFaturamentoOs(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
  const saldoCliente = calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
  if (valorFaturamento <= 0) return false;

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
    const ok = await atualizarReceitaOs(supabase, existente, valorFaturamento, obsReceita);
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
        valor: valorFaturamento,
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

  if (saldoCliente !== Number(os.valor_total)) {
    await supabase.from("ordens_servico").update({ valor_total: saldoCliente }).eq("id", osId);
  }

  return true;
}

/** Alinha receita existente antes da conclusão (evita falha quando há pagamentos parciais). */
export async function prepararReceitaConclusaoOs(supabase: Db, osId: string): Promise<void> {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select(
      "valor_itens, valor_visita, abater_visita, desconto, acrescimo, aprovado, motivo_atendimento"
    )
    .eq("id", osId)
    .single();

  if (!os || isRetornoGarantia(os)) return;

  const faturamento = calcReceitaFaturamentoOs(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );

  const receita = await buscarReceitaAtivaOs(supabase, osId);
  const pago = Number(receita?.valor_pago) || 0;

  if (faturamento <= 0) {
    if (!receita || pago <= 0) {
      throw new Error(
        "Não é possível concluir: inclua serviços/peças no orçamento ou registre o pagamento da visita."
      );
    }
    return;
  }

  if (receita) {
    const valorAtual = Number(receita.valor) || 0;
    const novoValor = Math.round(Math.max(faturamento, pago, valorAtual) * 100) / 100;
    if (Math.abs(novoValor - valorAtual) > 0.001) {
      const status = statusReceitaComPagamento(novoValor, pago);
      const { error } = await supabase
        .from("lancamentos_financeiros")
        .update({
          valor: novoValor,
          status,
          valor_liquido: status === "pago" ? novoValor : null,
        })
        .eq("id", receita.id);
      if (error) throw new Error(error.message);
    }
  } else if (os.aprovado) {
    const ok = await criarReceitaPendenteOs(supabase, osId);
    if (!ok) {
      throw new Error("Não foi possível preparar a receita da OS para conclusão.");
    }
  }
}

/** Financeiro na conclusão — receita normal ou custo de retorno em garantia. */
export async function sincronizarFinanceiroConclusaoOs(
  supabase: Db,
  osId: string,
  observacao?: string
): Promise<void> {
  const { data: osFin } = await supabase
    .from("ordens_servico")
    .select("motivo_atendimento")
    .eq("id", osId)
    .single();

  if (isRetornoGarantia(osFin ?? {})) {
    await sincronizarFinanceiroRetornoGarantia(
      supabase,
      osId,
      observacao ?? "Retorno em garantia concluído — custo registrado; pagamento manual"
    );
  } else {
    await prepararReceitaConclusaoOs(supabase, osId);
    await sincronizarReceitaOsInterno(
      supabase,
      osId,
      observacao ?? "Serviço concluído — receita registrada"
    );
  }
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
      "Não foi possível registrar o financeiro da OS. Confira se há itens no orçamento e se os pagamentos não excedem o total."
    );
  }
}

/** Registra pagamento recebido no check-out (após sincronizar receita). */
export async function registrarPagamentoReceitaOsCheckout(
  supabase: Db,
  osId: string,
  valorPagamento: number,
  formaPagamento?: string | null,
  observacao?: string,
  tipo: "saldo" | "sinal" | "parcial" | "outro" = "saldo"
): Promise<void> {
  const { registrarPagamentoOsComHistorico } = await import("@/lib/os-pagamentos");
  await registrarPagamentoOsComHistorico(supabase, {
    osId,
    valor: valorPagamento,
    tipo,
    formaPagamento,
    observacao,
    garantirReceita: false,
  });
}

/** Custo de garantia na conclusão — receita só via pagamento manual. */
export async function sincronizarFinanceiroRetornoGarantia(
  supabase: Db,
  osId: string,
  observacao?: string
): Promise<void> {
  const { data, error } = await supabase.rpc("sincronizar_financeiro_retorno_garantia", {
    p_os_id: osId,
    p_observacao: observacao ?? null,
  });

  if (error) {
    throw new Error(`Não foi possível registrar o custo de garantia: ${error.message}`);
  }
  if (!data) {
    throw new Error("Não foi possível sincronizar o financeiro do retorno em garantia.");
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
  custoTotal?: number
): Promise<void> {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select(
      "aprovado, valor_itens, valor_visita, abater_visita, desconto, acrescimo, custo_total, motivo_atendimento"
    )
    .eq("id", osId)
    .maybeSingle();

  if (!os?.aprovado) return;
  if (os.motivo_atendimento === "retorno_garantia") return;

  const valorFaturamento = calcReceitaFaturamentoOs(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
  const custo = custoTotal ?? Number(os.custo_total);

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
        l.status === "pago" &&
        pago + 0.001 >= valorAtual &&
        Math.abs(valorAtual - valorFaturamento) < 0.01;
      if (quitada) continue;
      if (pago > 0 && valorFaturamento + 0.001 < pago) continue;

      const status = statusReceitaComPagamento(valorFaturamento, pago);
      await supabase
        .from("lancamentos_financeiros")
        .update({
          valor: valorFaturamento,
          status,
          valor_liquido: status === "pago" ? valorFaturamento : null,
        })
        .eq("id", l.id);
    }

    if (
      l.tipo === "despesa" &&
      l.descricao?.startsWith("Custo OS-") &&
      !despesaProtegida
    ) {
      if (custo <= 0) {
        await supabase.from("lancamentos_financeiros").update({ status: "cancelado" }).eq("id", l.id);
      } else {
        await supabase.from("lancamentos_financeiros").update({ valor: custo }).eq("id", l.id);
      }
    }
  }

  const temCusto = lancamentos.some((l) => l.tipo === "despesa" && l.descricao?.startsWith("Custo OS-"));
  if (!temCusto && custo > 0) {
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
        valor: custo,
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
