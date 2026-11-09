import { ymdNoFuso } from "@/lib/format";
import { temPermissao, type Papel } from "@/lib/permissoes";
import type { OsPagamentoRow } from "@/lib/os-pagamentos";

/**
 * Espelha a regra do banco (RLS de os_pagamentos) só para mostrar/esconder botões:
 * - financeiro (admin/atendente): edita qualquer pagamento ainda não conciliado;
 * - técnico: só o que ele mesmo lançou, no mesmo dia, sem conciliação.
 */
export function podeEditarPagamento(
  perfil: { id: string; papel: Papel },
  p: Pick<OsPagamentoRow, "registrado_por" | "created_at" | "extrato_transacao_id">
): boolean {
  if (p.extrato_transacao_id) return false;
  if (temPermissao(perfil.papel, "financeiro")) return true;
  return p.registrado_por === perfil.id && ymdNoFuso(new Date(p.created_at)) === ymdNoFuso();
}

export function comPermissao<T extends OsPagamentoRow>(
  perfil: { id: string; papel: Papel },
  pagamentos: T[],
  contas: { id: string; nome: string }[] = []
) {
  const nomes = new Map(contas.map((c) => [c.id, c.nome]));
  return pagamentos.map((p) => ({
    ...p,
    podeEditar: podeEditarPagamento(perfil, p),
    contaNome: p.conta_id ? nomes.get(p.conta_id) ?? null : null,
  }));
}
