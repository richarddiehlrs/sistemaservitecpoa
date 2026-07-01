"use client";

import { useState } from "react";
import { Target, Pencil, Loader2, Check } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";

export function MetaCard({
  ano,
  mes,
  meta,
  realizado,
  action,
}: {
  ano: number;
  mes: number;
  meta: number;
  realizado: number;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [editando, setEditando] = useState(false);
  const { run, pending } = useAction();

  const pct = meta > 0 ? Math.min(100, (realizado / meta) * 100) : 0;
  const falta = Math.max(0, meta - realizado);
  const cor = pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-brand-500" : "bg-amber-500";

  function handle(formData: FormData) {
    run(() => action(formData), {
      successMsg: "Meta atualizada.",
      onSuccess: () => setEditando(false),
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Target className="h-4 w-4 text-brand-600" /> Meta vs recebido (caixa)
        </h2>
        {!editando && (
          <button onClick={() => setEditando(true)} className="text-slate-400 hover:text-brand-600" title="Definir meta">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {editando ? (
        <form action={handle} className="flex items-center gap-2">
          <input type="hidden" name="ano" value={ano} />
          <input type="hidden" name="mes" value={mes} />
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0"
            defaultValue={meta || ""}
            placeholder="Valor da meta (R$)"
            className="input"
            autoFocus
          />
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setEditando(false)} className="btn-secondary">
            Cancelar
          </button>
        </form>
      ) : meta > 0 ? (
        <>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(realizado)}</p>
              <p className="text-sm text-slate-500">de {formatCurrency(meta)}</p>
            </div>
            <span className={`text-lg font-bold ${pct >= 100 ? "text-green-600" : "text-slate-700"}`}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {pct >= 100 ? "Meta atingida! 🎉" : `Faltam ${formatCurrency(falta)} para bater a meta.`}
          </p>
        </>
      ) : (
        <div className="py-4 text-center">
          <p className="text-sm text-slate-400">Nenhuma meta definida para este mês.</p>
          <button onClick={() => setEditando(true)} className="btn-secondary mt-2">
            Definir meta
          </button>
        </div>
      )}
    </div>
  );
}
