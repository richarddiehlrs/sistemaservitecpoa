"use server";

// Livro de pagamentos: lançar, editar e excluir recebimentos/pagamentos.
// Usado pelo financeiro (admin/atendente) e pelo técnico nas OS dele.
// Quem pode o quê é garantido pelo banco (RLS da tabela os_pagamentos):
//   - financeiro: tudo, exceto pagamento já conciliado com o extrato;
//   - técnico: só nas OS dele, os que ele lançou, no mesmo dia.
// A soma (valor pago), o status e a data do título são recalculados pelo banco.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth-guard";
import { temPermissao } from "@/lib/permissoes";
import { hojeYmdLocal, parseNumForm } from "@/lib/format";
import { safeAction, type ActionResult } from "@/lib/action-result";
import type { TipoPagamentoOs } from "@/lib/os-pagamentos";

const TIPOS: TipoPagamentoOs[] = ["visita", "sinal", "saldo", "parcial", "outro", "baixa"];

function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

function dataValida(v: string | null): string {
  const hoje = hojeYmdLocal();
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return hoje;
  if (v > hoje) throw new Error("A data do pagamento não pode ser no futuro.");
  return v;
}

function revalidar(osId?: string | null, lancamentoId?: string | null) {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo");
  revalidatePath("/financeiro/conciliacao");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/dre");
  if (lancamentoId) revalidatePath(`/financeiro/lancamentos/${lancamentoId}`);
  if (osId) {
    revalidatePath(`/ordens/${osId}`);
    revalidatePath("/campo");
  }
}

/** Traduz erros do banco (RLS) para mensagem clara. */
function erroBanco(msg: string): Error {
  if (/row-level security|violates row-level/i.test(msg)) {
    return new Error(
      "Sem permissão para alterar este pagamento. Técnicos só alteram o que lançaram hoje; pagamentos conciliados só pelo financeiro."
    );
  }
  return new Error(msg);
}

export async function registrarPagamentoLancamento(formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const profile = await requireProfile();
    const supabase = await createClient();

    const lancamentoId = str(formData.get("lancamento_id"));
    if (!lancamentoId) throw new Error("Lançamento inválido.");

    const valor = parseNumForm(formData.get("valor"));
    if (valor <= 0) throw new Error("Informe um valor maior que zero.");

    const { data: lanc, error: errLanc } = await supabase
      .from("lancamentos_financeiros")
      .select("id, os_id, juros, multa, status")
      .eq("id", lancamentoId)
      .maybeSingle();
    if (errLanc || !lanc) throw new Error("Lançamento não encontrado.");

    const jurosNovos = parseNumForm(formData.get("juros"));
    const multaNovos = parseNumForm(formData.get("multa"));
    if (jurosNovos > 0 || multaNovos > 0) {
      if (!temPermissao(profile.papel, "financeiro")) {
        throw new Error("Somente o financeiro pode lançar juros e multa.");
      }
      const { error } = await supabase
        .from("lancamentos_financeiros")
        .update({
          juros: Math.round((Number(lanc.juros) + jurosNovos) * 100) / 100,
          multa: Math.round((Number(lanc.multa) + multaNovos) * 100) / 100,
        })
        .eq("id", lancamentoId);
      if (error) throw erroBanco(error.message);
    }

    const tipoRaw = str(formData.get("tipo")) as TipoPagamentoOs | null;
    const tipo: TipoPagamentoOs =
      tipoRaw && TIPOS.includes(tipoRaw) ? tipoRaw : lanc.os_id ? "parcial" : "baixa";

    const { error } = await supabase.from("os_pagamentos").insert({
      lancamento_id: lancamentoId,
      os_id: lanc.os_id,
      tipo,
      valor: Math.round(valor * 100) / 100,
      data_pagamento: dataValida(str(formData.get("data_pagamento"))),
      forma_pagamento: str(formData.get("forma_pagamento")),
      conta_id: str(formData.get("conta_id")),
      taxa: Math.max(0, parseNumForm(formData.get("taxa"))),
      observacao: str(formData.get("observacao")),
    });
    if (error) throw erroBanco(error.message);

    revalidar(lanc.os_id, lancamentoId);
  });
}

export async function editarPagamento(id: string, formData: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await requireProfile();
    const supabase = await createClient();

    const valor = parseNumForm(formData.get("valor"));
    if (valor <= 0) throw new Error("Informe um valor maior que zero.");

    const tipoRaw = str(formData.get("tipo")) as TipoPagamentoOs | null;
    const dados: Record<string, unknown> = {
      valor: Math.round(valor * 100) / 100,
      data_pagamento: dataValida(str(formData.get("data_pagamento"))),
      forma_pagamento: str(formData.get("forma_pagamento")),
      observacao: str(formData.get("observacao")),
    };
    if (tipoRaw && TIPOS.includes(tipoRaw)) dados.tipo = tipoRaw;
    if (formData.has("conta_id")) dados.conta_id = str(formData.get("conta_id"));
    if (formData.has("taxa")) dados.taxa = Math.max(0, parseNumForm(formData.get("taxa")));

    const { data, error } = await supabase
      .from("os_pagamentos")
      .update(dados)
      .eq("id", id)
      .select("os_id, lancamento_id")
      .maybeSingle();
    if (error) throw erroBanco(error.message);
    if (!data) {
      throw new Error(
        "Não foi possível alterar: pagamento não encontrado ou sem permissão (técnicos só alteram o que lançaram hoje)."
      );
    }
    revalidar(data.os_id, data.lancamento_id);
  });
}

export async function excluirPagamento(id: string): Promise<ActionResult> {
  return safeAction(async () => {
    await requireProfile();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("os_pagamentos")
      .delete()
      .eq("id", id)
      .select("os_id, lancamento_id")
      .maybeSingle();
    if (error) throw erroBanco(error.message);
    if (!data) {
      throw new Error(
        "Não foi possível excluir: pagamento não encontrado ou sem permissão (técnicos só excluem o que lançaram hoje)."
      );
    }
    revalidar(data.os_id, data.lancamento_id);
  });
}
