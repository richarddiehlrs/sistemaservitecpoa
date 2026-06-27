"use client";

import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { ConfirmButton } from "./confirm-button";

export function ExcluirAgendamentoButton({ action }: { action: () => Promise<ActionResult> }) {
  return (
    <ConfirmButton
      action={action}
      className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100"
      title="Excluir agendamento"
      message="Deseja excluir este agendamento da agenda? Use para remover visitas órfãs de OS já excluídas."
      confirmLabel="Excluir"
      successMsg="Agendamento removido."
    >
      <Trash2 className="h-3 w-3" /> Excluir visita
    </ConfirmButton>
  );
}
