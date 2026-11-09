"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { safeAction, type ActionResult } from "@/lib/action-result";
import { hojeYmdLocal } from "@/lib/format";
import { saldoEmAberto } from "@/lib/financeiro";

function revalidar() {
  for (const p of ["/financeiro", "/financeiro/fluxo", "/financeiro/pendencias", "/financeiro/conciliacao", "/dashboard", "/relatorios", "/dre"]) {
    revalidatePath(p);
  }
}

function ids(fd: FormData): string[] {
  return [...new Set(fd.getAll("ids").map(String).filter(Boolean))];
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dá baixa no saldo em aberto de vários títulos (já foram pagos e não estava registrado).
 * Data do pagamento: a escolhida, ou o vencimento / conclusão da OS de cada título.
 */
export async function baixarTitulos(fd: FormData): Promise<ActionResult<{ baixados: number; erros: string[] }>> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const lista = ids(fd);
    if (!lista.length) throw new Error("Selecione ao menos um título.");

    const modoData = String(fd.get("modo_data") || "vencimento"); // vencimento | conclusao | fixa
    const dataFixa = String(fd.get("data") || "");
    const forma = String(fd.get("forma_pagamento") || "").trim() || null;
    const hoje = hojeYmdLocal();
    if (modoData === "fixa" && (!DATA_RE.test(dataFixa) || dataFixa > hoje)) {
      throw new Error("Informe uma data válida (não pode ser no futuro).");
    }

    const supabase = await createClient();
    const { data: titulos, error } = await supabase
      .from("lancamentos_financeiros")
      .select("id, descricao, os_id, valor, valor_pago, juros, multa, status, data_vencimento, data_competencia, forma_pagamento, ordens_servico(data_conclusao)")
      .in("id", lista);
    if (error) throw new Error(error.message);

    let baixados = 0;
    const erros: string[] = [];
    for (const t of titulos || []) {
      if (t.status === "cancelado") continue;
      const saldo = saldoEmAberto(t);
      if (saldo <= 0) continue;

      const conclusao = (t as unknown as { ordens_servico?: { data_conclusao?: string | null } | null }).ordens_servico?.data_conclusao;
      let data =
        modoData === "fixa"
          ? dataFixa
          : modoData === "conclusao" && conclusao
            ? conclusao.slice(0, 10)
            : t.data_vencimento || t.data_competencia;
      if (!data || data > hoje) data = hoje;

      const { error: e } = await supabase.from("os_pagamentos").insert({
        lancamento_id: t.id,
        os_id: t.os_id,
        tipo: t.os_id ? "saldo" : "baixa",
        valor: saldo,
        data_pagamento: data,
        forma_pagamento: forma ?? t.forma_pagamento,
        observacao: "Baixa de pendência (pago e não registrado na época)",
      });
      if (e) erros.push(`${t.descricao}: ${e.message}`);
      else baixados++;
    }
    revalidar();
    return { baixados, erros };
  });
}

/**
 * Encerra títulos que não serão cobrados/pagos:
 *  - sem nenhum pagamento → cancelado;
 *  - com pagamento parcial → valor reduzido ao que foi pago (abatimento), fica quitado.
 */
export async function encerrarTitulos(fd: FormData): Promise<ActionResult<{ encerrados: number; erros: string[] }>> {
  return safeAction(async () => {
    await requirePermissao("financeiro");
    const lista = ids(fd);
    if (!lista.length) throw new Error("Selecione ao menos um título.");
    const motivo = String(fd.get("motivo") || "").trim() || "Encerrado sem cobrança";

    const supabase = await createClient();
    const { data: titulos, error } = await supabase
      .from("lancamentos_financeiros")
      .select("id, descricao, valor, valor_pago, juros, multa, status, observacoes")
      .in("id", lista);
    if (error) throw new Error(error.message);

    let encerrados = 0;
    const erros: string[] = [];
    for (const t of titulos || []) {
      if (t.status === "cancelado" || t.status === "pago") continue;
      const pago = Number(t.valor_pago) || 0;
      const obsAnterior = t.observacoes ? `${t.observacoes}\n` : "";
      let res;
      if (pago <= 0) {
        res = await supabase
          .from("lancamentos_financeiros")
          .update({ status: "cancelado", observacoes: `${obsAnterior}Cancelado: ${motivo}` })
          .eq("id", t.id);
      } else {
        const abatido = saldoEmAberto(t);
        const novoValor = Math.max(0, Math.round((pago - Number(t.juros || 0) - Number(t.multa || 0)) * 100) / 100);
        res = await supabase
          .from("lancamentos_financeiros")
          .update({
            valor: novoValor,
            observacoes: `${obsAnterior}Encerrado com abatimento de R$ ${abatido.toFixed(2).replace(".", ",")}: ${motivo}`,
          })
          .eq("id", t.id);
      }
      if (res.error) erros.push(`${t.descricao}: ${res.error.message}`);
      else encerrados++;
    }
    revalidar();
    return { encerrados, erros };
  });
}
