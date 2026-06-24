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

  const { data: osId, error } = await supabase.rpc("resolver_os_escaneamento", {
    p_numero: ref.tipo === "numero" ? ref.valor : null,
    p_id: ref.tipo === "id" ? ref.valor : null,
  });

  if (error) {
    return { erro: "Não foi possível localizar a ordem de serviço." };
  }

  if (osId) return { id: osId as string };

  return {
    erro:
      ref.tipo === "numero"
        ? `OS ${ref.valor} não encontrada ou sem permissão de acesso.`
        : "Ordem de serviço não encontrada ou sem permissão de acesso.",
  };
}
