"use client";

import { useState } from "react";
import { Loader2, Plus, Pencil, X } from "lucide-react";
import type { CategoriaFinanceira, DespesaRecorrente } from "@/types/database";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";

export function RecorrenteForm({
  categorias,
  action,
  recorrente,
  trigger,
}: {
  categorias: CategoriaFinanceira[];
  action: (formData: FormData) => Promise<ActionResult>;
  recorrente?: DespesaRecorrente;
  trigger?: "add" | "edit";
}) {
  const [aberto, setAberto] = useState(false);
  const { run, pending } = useAction();
  const cats = categorias.filter((c) => c.tipo === "despesa");
  const editando = !!recorrente;

  function handle(formData: FormData) {
    if (recorrente) formData.set("id", recorrente.id);
    run(() => action(formData), {
      successMsg: editando ? "Despesa fixa atualizada." : "Despesa fixa salva.",
      onSuccess: () => setAberto(false),
    });
  }

  const btn =
    trigger === "edit" ? (
      <button onClick={() => setAberto(true)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Editar">
        <Pencil className="h-4 w-4" />
      </button>
    ) : (
      <button onClick={() => setAberto(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Nova despesa fixa
      </button>
    );

  return (
    <>
      {btn}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card my-8 w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editando ? "Editar despesa fixa" : "Nova despesa fixa"}</h3>
              <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form action={handle} className="space-y-4">
              <div>
                <label className="label">Descrição *</label>
                <input name="descricao" required className="input" placeholder="Aluguel, Internet, etc."
                  defaultValue={recorrente?.descricao || ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor (R$) *</label>
                  <input name="valor" type="number" step="0.01" min="0" required className="input"
                    defaultValue={recorrente?.valor ?? ""} />
                </div>
                <div>
                  <label className="label">Dia do vencimento</label>
                  <input name="dia_vencimento" type="number" min="1" max="31" className="input"
                    defaultValue={recorrente?.dia_vencimento ?? 5} />
                </div>
              </div>
              <div>
                <label className="label">Categoria</label>
                <select name="categoria_id" className="input" defaultValue={recorrente?.categoria_id || ""}>
                  <option value="">-</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Observações</label>
                <textarea name="observacoes" rows={2} className="input" defaultValue={recorrente?.observacoes || ""} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAberto(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editando ? "Salvar" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

