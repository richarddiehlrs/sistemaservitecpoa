"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number {
  if (v == null) return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
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
  const d = new Date(dataISO + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export async function criarLancamento(formData: FormData) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

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
    // ajuste de centavos na última parcela
    const valor = i === parcelas - 1 ? Math.round((valorTotal - valorParcela * (parcelas - 1)) * 100) / 100 : valorParcela;
    const pago = status === "pago";
    return {
      tipo,
      descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})` : descricao,
      categoria_id,
      cliente_id,
      tecnico,
      valor,
      valor_pago: pago ? valor : 0,
      taxa_cartao: taxaParcela,
      valor_liquido: Math.round((valor - taxaParcela) * 100) / 100,
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
}

// Registra pagamento total ou parcial, com juros/multa.
export async function registrarPagamento(id: string, formData: FormData) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: l } = await supabase
    .from("lancamentos_financeiros")
    .select("valor, valor_pago, juros, multa, taxa_cartao, valor_liquido")
    .eq("id", id)
    .single();
  if (!l) throw new Error("Lançamento não encontrado.");

  const pagamento = num(formData.get("valor"));
  const jurosNovos = num(formData.get("juros"));
  const multaNovos = num(formData.get("multa"));
  const forma = str(formData.get("forma_pagamento"));
  const data = str(formData.get("data_pagamento")) || hoje;

  const juros = Number(l.juros) + jurosNovos;
  const multa = Number(l.multa) + multaNovos;
  const valorPago = Number(l.valor_pago) + pagamento;
  const devido = Number(l.valor) + juros + multa;
  const status = valorPago + 0.001 >= devido ? "pago" : "parcial";
  const liquidoBase = Number(l.valor_liquido ?? Number(l.valor) - Number(l.taxa_cartao));
  const valorLiquido = devido > 0 ? Math.round((valorPago / devido) * liquidoBase * 100) / 100 : liquidoBase;

  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({
      valor_pago: Math.round(valorPago * 100) / 100,
      juros,
      multa,
      valor_liquido: valorLiquido,
      forma_pagamento: forma,
      data_pagamento: data,
      status,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidarFinanceiro();
}

export async function marcarPago(id: string) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: l } = await supabase
    .from("lancamentos_financeiros")
    .select("valor, juros, multa")
    .eq("id", id)
    .single();
  const total = l ? Number(l.valor) + Number(l.juros) + Number(l.multa) : 0;
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({ status: "pago", data_pagamento: hoje, valor_pago: total })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidarFinanceiro();
}

export async function cancelarLancamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({ status: "cancelado" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidarFinanceiro();
}

export async function excluirLancamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarFinanceiro();
}

// ===================== DESPESAS RECORRENTES =====================

export async function salvarRecorrente(formData: FormData) {
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
}

export async function alternarRecorrente(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_recorrentes").update({ ativo }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro/recorrentes");
}

export async function excluirRecorrente(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_recorrentes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro/recorrentes");
}

// Gera os lançamentos das despesas fixas para o mês informado (YYYY-MM).
export async function gerarDespesasDoMes(formData: FormData) {
  const supabase = await createClient();
  const mes = str(formData.get("mes")) || new Date().toISOString().slice(0, 7);
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
}

// ===================== METAS =====================

export async function salvarMeta(formData: FormData) {
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
}
