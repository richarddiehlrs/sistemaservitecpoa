import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Equipamento } from "@/types/database";

type Db = SupabaseClient<Database>;

export type EquipamentoResumo = {
  tipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numero_serie?: string | null;
  voltagem?: string | null;
  cor?: string | null;
};

export function linhaEquipamento(e: EquipamentoResumo | Equipamento | null | undefined): string {
  if (!e) return "";
  const p = [e.tipo, e.marca, e.modelo].filter(Boolean).join(" ");
  const extra = [e.numero_serie ? `S/N ${e.numero_serie}` : null, e.voltagem, e.cor]
    .filter(Boolean)
    .join(" • ");
  return extra ? `${p} (${extra})` : p;
}

export function textoEquipamentos(equips: EquipamentoResumo[]): string {
  if (!equips.length) return "";
  return equips.map((e) => linhaEquipamento(e)).filter(Boolean).join(" • ");
}

function erroTabelaOsEquipamentos(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (msg.includes("os_equipamentos") &&
      (msg.includes("does not exist") ||
        msg.includes("schema cache") ||
        msg.includes("could not find")))
  );
}

async function fallbackEquipamentoPrincipal(supabase: Db, osId: string): Promise<Equipamento[]> {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select("equipamento_id, equipamentos(*)")
    .eq("id", osId)
    .single();

  // @ts-expect-error relação embutida
  const equip = os?.equipamentos as Equipamento | null;
  return equip ? [equip] : [];
}

/** Carrega equipamentos vinculados à OS (ordem preservada). */
export async function carregarEquipamentosOs(
  supabase: Db,
  osId: string
): Promise<Equipamento[]> {
  const { data: vinculos, error } = await supabase
    .from("os_equipamentos")
    .select("equipamento_id, ordem")
    .eq("os_id", osId)
    .order("ordem");

  if (error) {
    if (erroTabelaOsEquipamentos(error)) {
      return fallbackEquipamentoPrincipal(supabase, osId);
    }
    console.error("[os-equipamentos] Erro ao carregar vínculos:", error.message);
    return fallbackEquipamentoPrincipal(supabase, osId);
  }

  if (vinculos?.length) {
    const ids = vinculos.map((v) => v.equipamento_id);
    const { data: equips } = await supabase.from("equipamentos").select("*").in("id", ids);
    const map = new Map((equips || []).map((e) => [e.id, e]));
    return vinculos.map((v) => map.get(v.equipamento_id)).filter(Boolean) as Equipamento[];
  }

  return fallbackEquipamentoPrincipal(supabase, osId);
}

export type EquipamentoInput = {
  id?: string;
  tipo?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  voltagem?: string;
  cor?: string;
};

function str(v: unknown): string {
  return String(v ?? "").trim();
}

/** Resolve lista de equipamentos do formulário (existentes ou novos). */
export async function resolverEquipamentosOs(
  supabase: Db,
  clienteId: string,
  json: string
): Promise<string[]> {
  let itens: EquipamentoInput[] = [];
  try {
    itens = JSON.parse(json || "[]");
  } catch {
    return [];
  }

  const ids: string[] = [];
  for (const item of itens) {
    const existente = str(item.id);
    if (existente) {
      ids.push(existente);
      continue;
    }
    const tipo = str(item.tipo);
    if (!tipo) continue;

    const { data, error } = await supabase
      .from("equipamentos")
      .insert({
        cliente_id: clienteId,
        tipo,
        marca: str(item.marca) || null,
        modelo: str(item.modelo) || null,
        numero_serie: str(item.serie) || null,
        voltagem: str(item.voltagem) || null,
        cor: str(item.cor) || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    ids.push(data!.id);
  }
  return ids;
}

/** Salva vínculos OS ↔ equipamentos e atualiza equipamento principal. */
export async function salvarVinculosEquipamentosOs(
  supabase: Db,
  osId: string,
  equipamentoIds: string[]
): Promise<void> {
  const { error: delErr } = await supabase.from("os_equipamentos").delete().eq("os_id", osId);

  if (!delErr && equipamentoIds.length > 0) {
    const { error } = await supabase.from("os_equipamentos").insert(
      equipamentoIds.map((equipamento_id, ordem) => ({ os_id: osId, equipamento_id, ordem }))
    );
    if (error && !erroTabelaOsEquipamentos(error)) {
      throw new Error(error.message);
    }
  } else if (delErr && !erroTabelaOsEquipamentos(delErr)) {
    throw new Error(delErr.message);
  }

  await supabase
    .from("ordens_servico")
    .update({ equipamento_id: equipamentoIds[0] ?? null })
    .eq("id", osId);
}
