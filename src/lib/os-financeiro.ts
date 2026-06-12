import type { SupabaseClient } from "@supabase/supabase-js";
import { calcValorTotalCliente } from "@/lib/os-valores";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

export async function temLancamentoAtivoOs(supabase: Db, osId: string): Promise<boolean> {
  const { count } = await supabase
    .from("lancamentos_financeiros")
    .select("id", { count: "exact", head: true })
    .eq("os_id", osId)
    .neq("status", "cancelado");
  return (count ?? 0) > 0;
}

/** Cria receita pendente quando o orçamento é aprovado (portal ou ERP). */
export async function criarReceitaPendenteOs(supabase: Db, osId: string): Promise<boolean> {
  if (await temLancamentoAtivoOs(supabase, osId)) return false;

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

  const hoje = new Date().toISOString().slice(0, 10);
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

/** Sincroniza valores dos lançamentos ativos quando a OS é editada. */
export async function sincronizarFinanceiroOs(
  supabase: Db,
  osId: string,
  valorReceita: number,
  custoTotal: number
): Promise<void> {
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
    if (l.tipo === "receita" && l.status !== "pago") {
      await supabase.from("lancamentos_financeiros").update({ valor: valorReceita }).eq("id", l.id);
    }
    if (l.tipo === "despesa" && l.descricao?.startsWith("Custo OS-") && l.status !== "pago") {
      if (custoTotal > 0) {
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
      const hoje = new Date().toISOString().slice(0, 10);
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
        observacoes: "Custo sincronizado da OS",
      });
    }
  }
}
