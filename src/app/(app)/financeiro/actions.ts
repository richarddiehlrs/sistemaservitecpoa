"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { hojeYmdLocal, parseNumForm, ymdLocal } from "@/lib/format";
import { saldoEmAberto } from "@/lib/financeiro";
import { safeAction, type ActionResult } from "@/lib/action-result";
import { registrarPagamentoLancamento } from "./pagamentos-actions";

export type FinanceiroActionResult = ActionResult;

function num(v: FormDataEntryValue | null): number {
  return parseNumForm(v);
}
function int(v: FormDataEntryValue | null, def = 0): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : def;
}
function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

function revalidarFinanceiro() {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/recorrentes");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/dre");
  revalidatePath("/relatorios");
  revalidatePath("/dashboard");
}

function addMeses(dataISO: string, n: number): string {
  const d = new Date(dataISO + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return ymdLocal(d);
}

export async function criarLancamento(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const hoje = hojeYmdLocal();

    const tipo = String(formData.get("tipo") || "despesa") as "receita" | "despesa";
    const descricao = String(formData.get("descricao") || "").trim() || "Lançamento";
    const categoria_id = str(formData.get("categoria_id"));
    const cliente_id = str(formData.get("cliente_id"));
    const tecnico = str(formData.get("tecnico"));
    const forma = str(formData.get("forma_pagamento"));
    const observacoes = str(formData.get("observacoes"));
    const competencia = str(formData.get("data_competencia")) || hoje;
    const vencimento = str(formData.get("data_vencimento")) || competencia;
    const status = String(formData.get("status") || "pendente");
    const valorTotal = num(formData.get("valor"));
    const taxaCartao = num(formData.get("taxa_cartao"));
    const parcelas = Math.max(1, int(formData.get("parcelas"), 1));

    const valorParcela = Math.round((valorTotal / parcelas) * 100) / 100;
    const taxaParcela = Math.round((taxaCartao / parcelas) * 100) / 100;

    const linhas = Array.from({ length: parcelas }).map((_, i) => {
      const valor =
        i === parcelas - 1
          ? Math.round((valorTotal - valorParcela * (parcelas - 1)) * 100) / 100
          : valorParcela;
      const taxa =
        i === parcelas - 1
          ? Math.round((taxaCartao - taxaParcela * (parcelas - 1)) * 100) / 100
          : taxaParcela;
      const pago = status === "pago";
      return {
        tipo,
        descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})` : descricao,
        categoria_id,
        cliente_id,
        tecnico,
        valor,
        valor_pago: pago ? valor : 0,
        taxa_cartao: taxa,
        parcela_num: parcelas > 1 ? i + 1 : null,
        parcela_total: parcelas > 1 ? parcelas : null,
        data_competencia: competencia,
        data_vencimento: addMeses(vencimento, i),
        data_pagamento: pago ? hoje : null,
        status: pago ? "pago" : "pendente",
        forma_pagamento: forma,
        observacoes,
      };
    });

    const { error } = await supabase.from("lancamentos_financeiros").insert(linhas);
    if (error) throw new Error(error.message);
    revalidarFinanceiro();
  });
}

// Registra pagamento total ou parcial (com juros/multa) no livro de pagamentos.
export async function registrarPagamento(formData: FormData): Promise<ActionResult> {
  await requirePermissao("financeiro");
  return registrarPagamentoLancamento(formData);
}

export async function marcarPago(id: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const { data: l } = await supabase
      .from("lancamentos_financeiros")
      .select("valor, valor_pago, juros, multa, os_id, forma_pagamento")
      .eq("id", id)
      .single();
    if (!l) throw new Error("Lançamento não encontrado.");
    const saldo = saldoEmAberto(l);
    if (saldo <= 0) return;
    const { error } = await supabase.from("os_pagamentos").insert({
      lancamento_id: id,
      os_id: l.os_id,
      tipo: l.os_id ? "saldo" : "baixa",
      valor: saldo,
      data_pagamento: hojeYmdLocal(),
      forma_pagamento: l.forma_pagamento,
    });
    if (error) throw new Error(error.message);
    revalidarFinanceiro();
  });
}

/**
 * Edita os dados do título. Valor pago, status e data de pagamento NÃO são
 * editados aqui: vêm da lista de pagamentos (soma automática).
 */
export async function atualizarLancamento(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const hoje = hojeYmdLocal();

    const { data: atual } = await supabase
      .from("lancamentos_financeiros")
      .select("os_id, status")
      .eq("id", id)
      .single();
    if (!atual) throw new Error("Lançamento não encontrado.");

    const valor = num(formData.get("valor"));
    if (valor < 0) throw new Error("O valor não pode ser negativo.");

    const { error } = await supabase
      .from("lancamentos_financeiros")
      .update({
        tipo: String(formData.get("tipo") || "despesa") as "receita" | "despesa",
        descricao: String(formData.get("descricao") || "").trim() || "Lançamento",
        categoria_id: str(formData.get("categoria_id")),
        tecnico: str(formData.get("tecnico")),
        valor,
        juros: num(formData.get("juros")),
        multa: num(formData.get("multa")),
        data_competencia: str(formData.get("data_competencia")) || hoje,
        data_vencimento: str(formData.get("data_vencimento")),
        forma_pagamento: str(formData.get("forma_pagamento")),
        observacoes: str(formData.get("observacoes")),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    if (atual.os_id) revalidatePath(`/ordens/${atual.os_id}`);
    revalidatePath(`/financeiro/lancamentos/${id}`);
    revalidarFinanceiro();
  });
}

async function contarPagamentos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lancamentoId: string
): Promise<number> {
  const { count } = await supabase
    .from("os_pagamentos")
    .select("id", { count: "exact", head: true })
    .eq("lancamento_id", lancamentoId);
  return count ?? 0;
}

export async function cancelarLancamento(id: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    if ((await contarPagamentos(supabase, id)) > 0) {
      throw new Error(
        "Este lançamento tem pagamentos registrados. Exclua ou estorne os pagamentos antes de cancelar (o dinheiro já entrou/saiu do caixa)."
      );
    }
    const { error } = await supabase
      .from("lancamentos_financeiros")
      .update({ status: "cancelado" })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidarFinanceiro();
  });
}

export async function excluirLancamento(id: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();

    const { data: l } = await supabase
      .from("lancamentos_financeiros")
      .select("os_id")
      .eq("id", id)
      .single();

    if ((await contarPagamentos(supabase, id)) > 0) {
      throw new Error(
        "Este lançamento tem pagamentos registrados. Exclua os pagamentos primeiro ou use Cancelar."
      );
    }

    const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", id);
    if (error) throw new Error(error.message);

    if (l?.os_id) revalidatePath(`/ordens/${l.os_id}`);
    revalidarFinanceiro();
  });
}

// ===================== DESPESAS RECORRENTES =====================

export async function salvarRecorrente(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const id = str(formData.get("id"));
    const dados = {
      descricao: String(formData.get("descricao") || "").trim() || "Despesa fixa",
      categoria_id: str(formData.get("categoria_id")),
      valor: num(formData.get("valor")),
      dia_vencimento: Math.min(31, Math.max(1, int(formData.get("dia_vencimento"), 5))),
      ativo: formData.get("ativo") === "true" || formData.get("ativo") === "on" || !id,
      observacoes: str(formData.get("observacoes")),
    };
    const { error } = id
      ? await supabase.from("despesas_recorrentes").update(dados).eq("id", id)
      : await supabase.from("despesas_recorrentes").insert(dados);
    if (error) throw new Error(error.message);
    revalidatePath("/financeiro/recorrentes");
  });
}

export async function alternarRecorrente(
  id: string,
  ativo: boolean
): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const { error } = await supabase
      .from("despesas_recorrentes")
      .update({ ativo })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/financeiro/recorrentes");
  });
}

export async function excluirRecorrente(id: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const { error } = await supabase.from("despesas_recorrentes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/financeiro/recorrentes");
  });
}

// Gera os lançamentos das despesas fixas para o mês informado (YYYY-MM).
export async function gerarDespesasDoMes(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const mes = str(formData.get("mes")) || hojeYmdLocal().slice(0, 7);
    const [ano, m] = mes.split("-").map(Number);
    const inicio = `${mes}-01`;
    const ultimoDia = new Date(ano, m, 0).getDate();
    const fim = `${mes}-${String(ultimoDia).padStart(2, "0")}`;

    const [{ data: recs }, { data: existentes }] = await Promise.all([
      supabase.from("despesas_recorrentes").select("*").eq("ativo", true),
      supabase
        .from("lancamentos_financeiros")
        .select("recorrencia_id")
        .not("recorrencia_id", "is", null)
        .gte("data_competencia", inicio)
        .lte("data_competencia", fim),
    ]);

    const jaGerados = new Set((existentes || []).map((e) => e.recorrencia_id));
    const novos = (recs || [])
      .filter((r) => !jaGerados.has(r.id))
      .map((r) => ({
        tipo: "despesa" as const,
        descricao: r.descricao,
        categoria_id: r.categoria_id,
        valor: r.valor,
        data_competencia: inicio,
        data_vencimento: `${mes}-${String(Math.min(r.dia_vencimento, ultimoDia)).padStart(2, "0")}`,
        status: "pendente",
        recorrencia_id: r.id,
        observacoes: "Despesa fixa do mês",
      }));

    if (novos.length > 0) {
      const { error } = await supabase.from("lancamentos_financeiros").insert(novos);
      if (error) throw new Error(error.message);
    }
    revalidarFinanceiro();
  });
}

// ===================== METAS =====================

export async function salvarMeta(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const ano = int(formData.get("ano"), new Date().getFullYear());
    const mes = int(formData.get("mes"), new Date().getMonth() + 1);
    const valor = num(formData.get("valor"));

    const { error } = await supabase
      .from("metas_faturamento")
      .upsert({ ano, mes, valor }, { onConflict: "ano,mes" });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");
  });
}
