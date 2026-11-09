"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { filtrarAgendamentosOrfaos, filtrarLancamentosOrfaos } from "@/lib/orfaos";
import { listarOsInconsistentes, repararOs, repararTodasOs } from "@/lib/reparar-os";
import { safeAction, type ActionResult } from "@/lib/action-result";

async function idsOsValidos(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("ordens_servico").select("id");
  return new Set((data || []).map((o) => o.id));
}

async function excluirAgendamentoOrfaoImpl(id: string) {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarManutencao();
}

async function excluirLancamentoOrfaoImpl(id: string) {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarManutencao();
}

async function limparTodosOrfaosImpl() {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();
  const osIds = await idsOsValidos(supabase);

  const [{ data: agendamentos }, { data: lancamentos }] = await Promise.all([
    supabase.from("agendamentos").select("id, titulo, os_id"),
    supabase.from("lancamentos_financeiros").select("id, descricao, os_id"),
  ]);

  const agOrfaos = filtrarAgendamentosOrfaos(
    (agendamentos || []).map((a) => ({
      ...a,
      data: "",
      status: "",
      tecnico: null,
    })),
    osIds
  );
  const lancOrfaos = filtrarLancamentosOrfaos(
    (lancamentos || []).map((l) => ({
      ...l,
      tipo: "",
      valor: 0,
      status: "",
      data_competencia: "",
    })),
    osIds
  );

  if (agOrfaos.length > 0) {
    const { error } = await supabase.from("agendamentos").delete().in("id", agOrfaos.map((a) => a.id));
    if (error) throw new Error(error.message);
  }

  if (lancOrfaos.length > 0) {
    const { error } = await supabase
      .from("lancamentos_financeiros")
      .delete()
      .in("id", lancOrfaos.map((l) => l.id));
    if (error) throw new Error(error.message);
  }

  revalidarManutencao();
}

async function repararOsInconsistenteImpl(osId: string) {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();
  const resultado = await repararOs(supabase, osId);
  revalidarManutencao();
  revalidatePath(`/ordens/${osId}`);
  return resultado;
}

async function repararTodasOsInconsistentesImpl() {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();
  const resultados = await repararTodasOs(supabase);
  revalidarManutencao();
  revalidatePath("/ordens");
  return resultados;
}

// ===================== Wrappers seguros (ActionResult) =====================

export async function excluirAgendamentoOrfao(id: string): Promise<ActionResult> {
  return safeAction(() => excluirAgendamentoOrfaoImpl(id));
}

export async function excluirLancamentoOrfao(id: string): Promise<ActionResult> {
  return safeAction(() => excluirLancamentoOrfaoImpl(id));
}

export async function limparTodosOrfaos(): Promise<ActionResult> {
  return safeAction(() => limparTodosOrfaosImpl());
}

export async function repararOsInconsistente(
  osId: string
): Promise<ActionResult<Awaited<ReturnType<typeof repararOsInconsistenteImpl>>>> {
  return safeAction(() => repararOsInconsistenteImpl(osId));
}

export async function repararTodasOsInconsistentes(): Promise<
  ActionResult<Awaited<ReturnType<typeof repararTodasOsInconsistentesImpl>>>
> {
  return safeAction(() => repararTodasOsInconsistentesImpl());
}

function revalidarManutencao() {
  revalidatePath("/manutencao");
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
  revalidatePath("/campo");
  revalidatePath("/dashboard");
}

// ===================== CORTE DO FINANCEIRO =====================

/** Encerra em lote OS antigas (antes do início do financeiro), sem gerar lançamentos. */
export async function encerrarOsAntigas(
  formData: FormData
): Promise<ActionResult<{ encerradas: number; erros: string[] }>> {
  return safeAction(async () => {
    await requirePermissao("ordens_excluir");
    const { encerrarOsNoCorte } = await import("@/lib/corte-financeiro");
    const { getConfig } = await import("@/lib/config");
    const supabase = await createClient();
    const config = await getConfig();
    const corte = config.financeiro_inicio;
    if (!corte) throw new Error("Defina a data de início do financeiro em Configurações.");

    const ids = [...new Set(formData.getAll("ids").map(String).filter(Boolean))];
    if (!ids.length) throw new Error("Selecione ao menos uma OS.");
    const modo = String(formData.get("modo")) === "nao_feita" ? "nao_feita" : "feita";

    let encerradas = 0;
    const erros: string[] = [];
    for (const id of ids) {
      try {
        await encerrarOsNoCorte(supabase, id, modo, corte);
        encerradas++;
      } catch (e) {
        erros.push(e instanceof Error ? e.message : String(e));
      }
    }
    for (const p of ["/manutencao", "/manutencao/encerrar-antigas", "/ordens", "/painel", "/financeiro", "/financeiro/pendencias", "/financeiro/fluxo", "/dashboard", "/resultados", "/dre", "/agenda", "/campo"]) {
      revalidatePath(p);
    }
    return { encerradas, erros };
  });
}
