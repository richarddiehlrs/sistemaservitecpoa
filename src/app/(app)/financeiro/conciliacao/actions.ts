"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { safeAction, type ActionResult } from "@/lib/action-result";
import { lerExtrato, type ResultadoExtrato, type TransacaoExtrato } from "@/lib/extrato";
import { paresAutomaticos } from "@/lib/conciliacao";
import { carregarPendencias } from "@/lib/conciliacao-dados";
import { parseNumForm } from "@/lib/format";

const MAX_BYTES = 8 * 1024 * 1024;

function revalidar() {
  revalidatePath("/financeiro/conciliacao");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo");
}

function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

export type PreviaExtrato = ResultadoExtrato & {
  arquivoNome: string;
  contaId: string;
  /** Chaves que já existem no banco para esta conta (não serão importadas de novo). */
  jaImportadas: string[];
};

/** 1º passo: lê o arquivo e devolve as linhas para conferência (nada é gravado). */
export async function previsualizarExtrato(formData: FormData): Promise<ActionResult<PreviaExtrato>> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const contaId = str(formData.get("conta_id"));
    const arquivo = formData.get("arquivo");
    if (!contaId) throw new Error("Escolha a conta do extrato.");
    if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error("Selecione o arquivo do extrato.");
    if (arquivo.size > MAX_BYTES) throw new Error("Arquivo muito grande (máx. 8 MB).");

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    let resultado: ResultadoExtrato;
    try {
      resultado = await lerExtrato(arquivo.name, bytes);
    } catch (e) {
      throw new Error(
        `Não consegui ler o arquivo (${e instanceof Error ? e.message : "formato desconhecido"}). Use OFX, CSV ou PDF exportado pelo banco.`
      );
    }

    const supabase = await createClient();
    const chaves = resultado.transacoes.map((t) => t.chave);
    const jaImportadas: string[] = [];
    for (let i = 0; i < chaves.length; i += 200) {
      const { data } = await supabase
        .from("extrato_transacoes")
        .select("chave")
        .eq("conta_id", contaId)
        .in("chave", chaves.slice(i, i + 200));
      for (const r of data || []) jaImportadas.push(r.chave);
    }

    return { ...resultado, arquivoNome: arquivo.name, contaId, jaImportadas };
  });
}

export type ImportacaoPayload = {
  contaId: string;
  arquivoNome: string;
  formato: "ofx" | "csv" | "pdf";
  periodoInicio?: string | null;
  periodoFim?: string | null;
  saldoFinal?: number | null;
  transacoes: TransacaoExtrato[];
};

/** 2º passo: grava as linhas conferidas pelo usuário (ignora as já importadas). */
export async function importarExtrato(
  payload: ImportacaoPayload
): Promise<ActionResult<{ inseridas: number; duplicadas: number }>> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();

    const txs = (payload.transacoes || []).filter(
      (t) =>
        /^\d{4}-\d{2}-\d{2}$/.test(t.data) &&
        Number.isFinite(t.valor) &&
        Math.abs(t.valor) >= 0.01 &&
        typeof t.chave === "string" &&
        t.chave.length > 0
    );
    if (!txs.length) throw new Error("Nenhuma transação válida para importar.");

    const { data: imp, error: errImp } = await supabase
      .from("extrato_importacoes")
      .insert({
        conta_id: payload.contaId,
        arquivo_nome: payload.arquivoNome?.slice(0, 200) ?? null,
        formato: payload.formato,
        periodo_inicio: payload.periodoInicio ?? null,
        periodo_fim: payload.periodoFim ?? null,
        saldo_final: payload.saldoFinal ?? null,
      })
      .select("id")
      .single();
    if (errImp || !imp) throw new Error(errImp?.message || "Erro ao registrar importação.");

    const linhas = txs.map((t) => ({
      conta_id: payload.contaId,
      importacao_id: imp.id,
      data: t.data,
      valor: Math.round(t.valor * 100) / 100,
      descricao: String(t.descricao || "").slice(0, 300),
      documento: t.documento ? String(t.documento).slice(0, 60) : null,
      chave: t.chave.slice(0, 300),
    }));

    let inseridas = 0;
    for (let i = 0; i < linhas.length; i += 500) {
      const { data, error } = await supabase
        .from("extrato_transacoes")
        .upsert(linhas.slice(i, i + 500), { onConflict: "conta_id,chave", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      inseridas += data?.length ?? 0;
    }
    const duplicadas = linhas.length - inseridas;

    await supabase
      .from("extrato_importacoes")
      .update({ qtd_transacoes: inseridas, qtd_duplicadas: duplicadas })
      .eq("id", imp.id);

    if (inseridas === 0) {
      await supabase.from("extrato_importacoes").delete().eq("id", imp.id);
    }

    revalidar();
    return { inseridas, duplicadas };
  });
}

export async function conciliarTransacao(
  transacaoId: string,
  pagamentoIds: string[],
  diferencaComoTaxa: boolean
): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const { error } = await supabase.rpc("conciliar_transacao", {
      p_transacao_id: transacaoId,
      p_pagamento_ids: pagamentoIds,
      p_diferenca_como_taxa: diferencaComoTaxa,
    });
    if (error) throw new Error(error.message);
    revalidar();
  });
}

export async function desfazerConciliacao(transacaoId: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const { data: tx } = await supabase
      .from("extrato_transacoes")
      .select("status")
      .eq("id", transacaoId)
      .maybeSingle();
    if (!tx) throw new Error("Transação não encontrada.");
    if (tx.status === "ignorado") {
      const { error } = await supabase
        .from("extrato_transacoes")
        .update({ status: "pendente", observacao: null, conciliado_por: null, conciliado_em: null })
        .eq("id", transacaoId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.rpc("desconciliar_transacao", { p_transacao_id: transacaoId });
      if (error) throw new Error(error.message);
    }
    revalidar();
  });
}

export async function ignorarTransacao(transacaoId: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const profile = await requirePermissao("financeiro");
    const supabase = await createClient();
    const { error } = await supabase
      .from("extrato_transacoes")
      .update({
        status: "ignorado",
        observacao: str(formData.get("observacao")) ?? "Ignorado (ex.: transferência entre contas)",
        conciliado_por: profile.id,
        conciliado_em: new Date().toISOString(),
      })
      .eq("id", transacaoId)
      .eq("status", "pendente");
    if (error) throw new Error(error.message);
    revalidar();
  });
}

/** Cria lançamento (ex.: tarifa bancária, PIX avulso) já pago e conciliado. */
export async function criarLancamentoDaTransacao(
  transacaoId: string,
  formData: FormData
): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const { error } = await supabase.rpc("criar_lancamento_de_transacao", {
      p_transacao_id: transacaoId,
      p_descricao: str(formData.get("descricao")) ?? "",
      p_categoria_id: str(formData.get("categoria_id")),
      p_cliente_id: null,
    });
    if (error) throw new Error(error.message);
    revalidar();
  });
}

/** Concilia sozinho só os casos sem dúvida (valor exato, até 3 dias, sem concorrente). */
export async function conciliarAutomaticamente(formData: FormData): Promise<ActionResult<{ conciliadas: number }>> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const contaId = str(formData.get("conta_id"));
    const inicio = str(formData.get("inicio"));
    const fim = str(formData.get("fim"));
    if (!contaId || !inicio || !fim) throw new Error("Período inválido.");

    const supabase = await createClient();
    const { txs, pagamentos } = await carregarPendencias(supabase, contaId, inicio, fim);
    const pares = paresAutomaticos(txs, pagamentos);

    let conciliadas = 0;
    for (const par of pares) {
      const { error } = await supabase.rpc("conciliar_transacao", {
        p_transacao_id: par.transacaoId,
        p_pagamento_ids: [par.pagamentoId],
        p_diferenca_como_taxa: false,
      });
      if (!error) conciliadas++;
    }
    revalidar();
    return { conciliadas };
  });
}

export async function excluirImportacao(importacaoId: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const { count } = await supabase
      .from("extrato_transacoes")
      .select("id", { count: "exact", head: true })
      .eq("importacao_id", importacaoId)
      .neq("status", "pendente");
    if ((count ?? 0) > 0) {
      throw new Error("Esta importação tem linhas conciliadas ou ignoradas. Desfaça essas conciliações antes de excluir.");
    }
    const { error } = await supabase.from("extrato_importacoes").delete().eq("id", importacaoId);
    if (error) throw new Error(error.message);
    revalidar();
  });
}

// ---------------- contas ----------------

export async function salvarConta(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const supabase = await createClient();
    const id = str(formData.get("id"));
    const tipo = String(formData.get("tipo") || "banco");
    const dados = {
      nome: str(formData.get("nome")) ?? "Conta",
      tipo: (["banco", "maquininha", "caixa", "outro"].includes(tipo) ? tipo : "banco") as
        | "banco"
        | "maquininha"
        | "caixa"
        | "outro",
      banco: str(formData.get("banco")),
      agencia: str(formData.get("agencia")),
      numero: str(formData.get("numero")),
      formas_padrao: formData.getAll("formas_padrao").map(String).filter(Boolean),
      saldo_inicial: parseNumForm(formData.get("saldo_inicial")),
      data_saldo_inicial: str(formData.get("data_saldo_inicial")),
      ativo: formData.get("ativo") !== "false",
    };
    const { error } = id
      ? await supabase.from("contas_financeiras").update(dados).eq("id", id)
      : await supabase.from("contas_financeiras").insert(dados);
    if (error) throw new Error(error.message);
    revalidar();
    revalidatePath("/financeiro/contas");
  });
}
