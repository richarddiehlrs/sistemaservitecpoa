"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { filtrarAgendamentosOrfaos, filtrarLancamentosOrfaos } from "@/lib/orfaos";

async function idsOsValidos(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("ordens_servico").select("id");
  return new Set((data || []).map((o) => o.id));
}

export async function excluirAgendamentoOrfao(id: string) {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarManutencao();
}

export async function excluirLancamentoOrfao(id: string) {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarManutencao();
}

export async function limparTodosOrfaos() {
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

function revalidarManutencao() {
  revalidatePath("/manutencao");
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
  revalidatePath("/campo");
  revalidatePath("/dashboard");
}
