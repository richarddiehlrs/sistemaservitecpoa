"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { extrairReferenciaOs } from "@/lib/os-scan";

export async function resolverOsPorCodigo(
  codigo: string
): Promise<{ id?: string; erro?: string }> {
  await requirePermissao("ordens");
  const ref = extrairReferenciaOs(codigo);
  if (!ref) {
    return { erro: "Código inválido. Escaneie o QR da etiqueta ou digite o número da OS." };
  }

  const supabase = await createClient();

  if (ref.tipo === "id") {
    const { data } = await supabase
      .from("ordens_servico")
      .select("id")
      .eq("id", ref.valor)
      .maybeSingle();
    if (data) return { id: data.id };
    return { erro: "Ordem de serviço não encontrada." };
  }

  const { data } = await supabase
    .from("ordens_servico")
    .select("id")
    .eq("numero", ref.valor)
    .maybeSingle();
  if (data) return { id: data.id };
  return { erro: `OS ${ref.valor} não encontrada.` };
}
