"use client";

import { Trash2 } from "lucide-react";
import type { CategoriaFinanceira, LancamentoFinanceiro } from "@/types/database";
import type { ActionResult } from "@/lib/action-result";
import { ConfirmButton } from "./confirm-button";
import { EditarLancamento } from "./editar-lancamento";

export function LancamentoAcoes({
  lancamento,
  categorias,
  editarAction,
  excluirAction,
  compact = true,
}: {
  lancamento: LancamentoFinanceiro;
  categorias: CategoriaFinanceira[];
  editarAction: (formData: FormData) => Promise<ActionResult>;
  excluirAction: () => Promise<ActionResult>;
  compact?: boolean;
}) {
  if (lancamento.status === "cancelado") {
    return (
      <ConfirmButton
        action={excluirAction}
        className={compact ? "rounded p-1.5 text-red-500 hover:bg-red-50" : "btn-danger"}
        title="Excluir lançamento"
        message="Deseja excluir permanentemente este lançamento cancelado?"
        confirmLabel="Excluir"
        successMsg="Lançamento excluído."
      >
        <Trash2 className="h-4 w-4" />
      </ConfirmButton>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <EditarLancamento lancamento={lancamento} categorias={categorias} action={editarAction} compact={compact} />
      <ConfirmButton
        action={excluirAction}
        className={compact ? "rounded p-1.5 text-red-500 hover:bg-red-50" : "btn-danger"}
        title="Excluir lançamento"
        message="Deseja excluir permanentemente este lançamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        successMsg="Lançamento excluído."
      >
        <Trash2 className="h-4 w-4" />
      </ConfirmButton>
    </div>
  );
}
