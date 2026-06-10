"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "./confirm-button";

export function ClienteAcoes({
  clienteId,
  excluirAction,
  compact = true,
  somenteExcluir = false,
}: {
  clienteId: string;
  excluirAction: () => Promise<void>;
  compact?: boolean;
  somenteExcluir?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {!somenteExcluir && (
        <Link
          href={`/clientes/${clienteId}/editar`}
          className={compact ? "rounded p-1.5 text-slate-500 hover:bg-slate-100" : "btn-secondary"}
          title="Editar cliente"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      )}
      <ConfirmButton
        action={excluirAction}
        className={
          compact
            ? "rounded p-1.5 text-red-500 hover:bg-red-50"
            : "btn-danger inline-flex items-center gap-2"
        }
        title="Excluir cliente"
        message="Deseja excluir este cliente permanentemente? Só é possível se não houver ordens de serviço vinculadas."
        confirmLabel="Excluir"
        successMsg="Cliente excluído."
      >
        <Trash2 className="h-4 w-4" /> {!compact && "Excluir"}
      </ConfirmButton>
    </div>
  );
}
