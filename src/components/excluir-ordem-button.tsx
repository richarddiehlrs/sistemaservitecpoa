"use client";

import { Trash2 } from "lucide-react";
import { ConfirmButton } from "./confirm-button";

export function ExcluirOrdemButton({ action }: { action: () => Promise<void> }) {
  return (
    <ConfirmButton
      action={action}
      className="rounded p-1.5 text-red-500 hover:bg-red-50"
      title="Excluir ordem de serviço"
      message="Deseja excluir esta ordem permanentemente? Agendamentos, lançamentos financeiros e todos os dados vinculados serão removidos."
      confirmLabel="Excluir"
      successMsg="Ordem excluída."
    >
      <Trash2 className="h-4 w-4" />
    </ConfirmButton>
  );
}
