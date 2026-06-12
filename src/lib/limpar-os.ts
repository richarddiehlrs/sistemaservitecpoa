import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Remove fotos do Storage vinculadas à OS. */
export async function limparAnexosStorageOs(supabase: Supabase, osId: string) {
  const { data: anexos } = await supabase.from("os_anexos").select("path").eq("os_id", osId);
  const paths = (anexos ?? []).map((a) => a.path).filter((p): p is string => Boolean(p?.trim()));
  if (paths.length > 0) {
    await supabase.storage.from("os-fotos").remove(paths);
  }
}

/** Remove agenda, financeiro e arquivos antes de excluir a OS. */
export async function limparDadosVinculadosOs(
  supabase: Supabase,
  osId: string,
  numero?: number | null
) {
  await limparAnexosStorageOs(supabase, osId);

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

  if (numero != null) {
    const numeroFmt = `OS-${String(numero).padStart(5, "0")}`;
    await supabase.from("agendamentos").delete().ilike("titulo", `%Visita ${numeroFmt}%`);
  }
}
