import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Remove agenda e financeiro vinculados antes de excluir a OS. */
export async function limparDadosVinculadosOs(
  supabase: Supabase,
  osId: string,
  numero?: number | null
) {
  const { error: errLanc } = await supabase
    .from("lancamentos_financeiros")
    .delete()
    .eq("os_id", osId);
  if (errLanc) throw new Error(`Erro ao remover lançamentos: ${errLanc.message}`);

  if (numero != null) {
    const numeroFmt = `OS-${String(numero).padStart(5, "0")}`;
    await supabase
      .from("lancamentos_financeiros")
      .delete()
      .or(`descricao.eq.Receita ${numeroFmt},descricao.eq.Custo ${numeroFmt}`);
  }

  const { error: errAgenda } = await supabase
    .from("agendamentos")
    .delete()
    .eq("os_id", osId);
  if (errAgenda) throw new Error(`Erro ao remover agendamentos: ${errAgenda.message}`);

  // Agendamentos órfãos (exclusões antigas só desvinculavam os_id)
  if (numero != null) {
    const numeroFmt = `OS-${String(numero).padStart(5, "0")}`;
    await supabase.from("agendamentos").delete().ilike("titulo", `%Visita ${numeroFmt}%`);
  }
}
