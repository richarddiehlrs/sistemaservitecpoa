"use client";

import { useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import type { CategoriaFinanceira, LancamentoFinanceiro } from "@/types/database";
import type { ActionResult } from "@/lib/action-result";
import { formatCurrency } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";
import { useAction } from "./use-action";

type LancamentoEdit = Pick<
  LancamentoFinanceiro,
  | "id"
  | "tipo"
  | "descricao"
  | "valor"
  | "valor_pago"
  | "juros"
  | "multa"
  | "categoria_id"
  | "tecnico"
  | "data_competencia"
  | "data_vencimento"
  | "data_pagamento"
  | "status"
  | "forma_pagamento"
  | "observacoes"
>;

export function EditarLancamento({
  lancamento,
  categorias,
  action,
  compact = false,
}: {
  lancamento: LancamentoEdit;
  categorias: CategoriaFinanceira[];
  action: (formData: FormData) => Promise<ActionResult>;
  compact?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const { run, pending } = useAction();

  const cats = categorias.filter((c) => c.tipo === lancamento.tipo);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => action(fd), {
      successMsg: "Lançamento atualizado.",
      onSuccess: () => setAberto(false),
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={compact ? "rounded p-1.5 text-slate-500 hover:bg-slate-100" : "btn-secondary"}
        title="Editar lançamento"
      >
        <Pencil className="h-4 w-4" />
        {!compact && " Editar"}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card my-8 w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Editar lançamento</h3>
              <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <input type="hidden" name="tipo" value={lancamento.tipo} />

              <div>
                <label className="label">Descrição *</label>
                <input name="descricao" required className="input" defaultValue={lancamento.descricao} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor (R$) *</label>
                  <input name="valor" type="number" step="0.01" min="0" required className="input"
                    defaultValue={lancamento.valor} />
                </div>
                <div>
                  <label className="label">Categoria</label>
                  <select name="categoria_id" className="input" defaultValue={lancamento.categoria_id || ""}>
                    <option value="">-</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Juros (R$)</label>
                  <input name="juros" type="number" step="0.01" min="0" className="input"
                    defaultValue={lancamento.juros || 0} />
                </div>
                <div>
                  <label className="label">Multa (R$)</label>
                  <input name="multa" type="number" step="0.01" min="0" className="input"
                    defaultValue={lancamento.multa || 0} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Competência</label>
                  <input name="data_competencia" type="date" className="input"
                    defaultValue={lancamento.data_competencia} />
                </div>
                <div>
                  <label className="label">Vencimento</label>
                  <input name="data_vencimento" type="date" className="input"
                    defaultValue={lancamento.data_vencimento || ""} />
                </div>
              </div>

              <div>
                <label className="label">Forma de pagamento prevista</label>
                <select name="forma_pagamento" className="input" defaultValue={lancamento.forma_pagamento || ""}>
                  <option value="">-</option>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Já pago: <strong>{formatCurrency(Number(lancamento.valor_pago || 0))}</strong>. Para lançar,
                corrigir ou excluir pagamentos use a lista de pagamentos — a soma e a situação
                ({lancamento.tipo === "receita" ? "a receber / parcial / recebido" : "a pagar / parcial / pago"})
                são atualizadas automaticamente.
              </p>

              {lancamento.tipo === "receita" && (
                <div>
                  <label className="label">Técnico (comissão)</label>
                  <input name="tecnico" className="input" defaultValue={lancamento.tecnico || ""} />
                </div>
              )}

              <div>
                <label className="label">Observações</label>
                <textarea name="observacoes" rows={2} className="input" defaultValue={lancamento.observacoes || ""} />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAberto(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
