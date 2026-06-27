"use client";

import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import type { ServicoCatalogo } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";

type Props = {
  servicos: ServicoCatalogo[];
  podeEditar: boolean;
  salvar: (formData: FormData) => Promise<ActionResult>;
  excluir: (id: string) => Promise<ActionResult>;
};

export function CatalogoManager({ servicos, podeEditar, salvar, excluir }: Props) {
  const [editando, setEditando] = useState<ServicoCatalogo | null>(null);
  const [criando, setCriando] = useState(false);
  const { run, pending } = useAction();

  const aberto = criando || editando !== null;

  function handle(formData: FormData) {
    run(() => salvar(formData), {
      successMsg: "Item salvo.",
      onSuccess: () => {
        setCriando(false);
        setEditando(null);
      },
    });
  }
  function remover(id: string) {
    run(() => excluir(id), { successMsg: "Item excluído." });
  }

  return (
    <div>
      {podeEditar && (
        <div className="mb-4">
          <button onClick={() => setCriando(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Novo item
          </button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Tipo</th>
              <th className="text-right">Valor</th>
              <th>Situação</th>
              {podeEditar && <th className="text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {servicos.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Nenhum item no catálogo.
                </td>
              </tr>
            ) : (
              servicos.map((s) => (
                <tr key={s.id} className={!s.ativo ? "opacity-50" : ""}>
                  <td className="font-medium">{s.descricao}</td>
                  <td className="capitalize">{s.tipo}</td>
                  <td className="text-right">{formatCurrency(s.valor)}</td>
                  <td>{s.ativo ? "Ativo" : "Inativo"}</td>
                  {podeEditar && (
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditando(s)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remover(s.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card my-8 w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editando ? "Editar item" : "Novo item"}</h3>
              <button onClick={() => { setCriando(false); setEditando(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form action={handle} className="space-y-4">
              {editando && <input type="hidden" name="id" value={editando.id} />}
              <div>
                <label className="label">Descrição *</label>
                <input name="descricao" required defaultValue={editando?.descricao || ""} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select name="tipo" defaultValue={editando?.tipo || "servico"} className="input">
                    <option value="servico">Serviço</option>
                    <option value="peca">Peça</option>
                  </select>
                </div>
                <div>
                  <label className="label">Valor (R$)</label>
                  <input name="valor" type="number" step="0.01" min="0" defaultValue={editando?.valor ?? 0} className="input" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="ativo" value="true" defaultChecked={editando ? editando.ativo : true} />
                Item ativo
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setCriando(false); setEditando(null); }} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
