import type { SupabaseClient } from "@supabase/supabase-js";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { hojeYmdLocal } from "@/lib/format";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

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

/** Cria receita pendente quando o orçamento é aprovado (portal ou ERP). Idempotente. */
export async function criarReceitaPendenteOs(supabase: Db, osId: string): Promise<boolean> {
  if (await temReceitaAtivaOs(supabase, osId)) return true;

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

  const [{ data: catReceita }, { data: catCusto }] = await Promise.all([
    supabase.from("categorias_financeiras").select("id").eq("nome", "Serviços de assistência técnica").limit(1).maybeSingle(),
    supabase.from("categorias_financeiras").select("id").eq("nome", "Compra de peças").limit(1).maybeSingle(),
  ]);

  const hoje = hojeYmdLocal();
  const numeroFmt = `OS-${String(os.numero).padStart(5, "0")}`;

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
      observacoes: "Gerado automaticamente na aprovação do orçamento",
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

  if (valorReceita !== Number(os.valor_total)) {
    await supabase.from("ordens_servico").update({ valor_total: valorReceita }).eq("id", osId);
  }

  return true;
}

/** Cancela receita e custo automáticos pendentes (mantém despesas de campo e quitados). */
export async function cancelarReceitaPendenteOs(supabase: Db, osId: string): Promise<void> {
  const { data: lancamentos } = await supabase
    .from("lancamentos_financeiros")
    .select("id, tipo, descricao, status, origem, valor_pago")
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
    if (l.origem === "campo" || l.status === "pago") continue;
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
    .select("id, origem, status")
    .eq("os_id", osId)
    .neq("status", "cancelado");

  const ids = (lancamentos || [])
    .filter((l) => l.origem !== "campo" && l.status !== "pago")
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
    .select("id, tipo, descricao, status, valor_pago")
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
    const receitaProtegida = l.tipo === "receita" && ["pago", "parcial"].includes(l.status);
    const despesaProtegida = l.tipo === "despesa" && l.status === "pago";

    if (l.tipo === "receita" && !receitaProtegida) {
      const pago = Number(l.valor_pago) || 0;
      if (pago > 0 && valorReceita < pago) continue;
      await supabase.from("lancamentos_financeiros").update({ valor: valorReceita }).eq("id", l.id);
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

  // Cria custo pendente se ainda não existe e há custo na OS
  const temCusto = lancamentos.some((l) => l.tipo === "despesa" && l.descricao?.startsWith("Custo OS-"));
  if (!temCusto && custoTotal > 0) {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("numero, cliente_id")
      .eq("id", osId)
      .single();
    if (os) {
      const numeroFmt = `OS-${String(os.numero).padStart(5, "0")}`;
      const hoje = hojeYmdLocal();
      await supabase.from("lancamentos_financeiros").insert({
        tipo: "despesa",
        descricao: `Custo ${numeroFmt}`,
        categoria_id: catCusto?.id ?? null,
        os_id: osId,
        cliente_id: os.cliente_id,
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
