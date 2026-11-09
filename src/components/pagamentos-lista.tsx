"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, Pencil, Trash2, X } from "lucide-react";
import { formatCurrency, formatDate, hojeYmdLocal } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";
import { LABEL_TIPO_PAGAMENTO, type OsPagamentoRow, type TipoPagamentoOs } from "@/lib/os-pagamentos";
import { editarPagamento, excluirPagamento } from "@/app/(app)/financeiro/pagamentos-actions";
import { useAction } from "./use-action";

export type PagamentoLinha = OsPagamentoRow & {
  /** Calculado no servidor conforme papel/regras (o banco valida de novo). */
  podeEditar: boolean;
  contaNome?: string | null;
};

type ContaOpcao = { id: string; nome: string };

const TIPOS_OS: TipoPagamentoOs[] = ["visita", "sinal", "parcial", "saldo", "outro"];

/**
 * Lista de pagamentos de um lançamento/OS com edição e exclusão.
 * A soma e o status do título são recalculados automaticamente pelo banco.
 */
export function PagamentosLista({
  pagamentos,
  contas,
  mostrarConta = true,
  titulo = "Pagamentos recebidos",
  tipoLancamento = "receita",
}: {
  pagamentos: PagamentoLinha[];
  contas?: ContaOpcao[];
  mostrarConta?: boolean;
  titulo?: string;
  tipoLancamento?: "receita" | "despesa";
}) {
  const [editando, setEditando] = useState<PagamentoLinha | null>(null);
  const { run, pending } = useAction();

  if (!pagamentos.length) return null;

  const total = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  const taxas = pagamentos.reduce((s, p) => s + Number(p.taxa || 0), 0);

  function excluir(p: PagamentoLinha) {
    if (!window.confirm(`Excluir o pagamento de ${formatCurrency(p.valor)} de ${formatDate(p.data_pagamento)}? A soma será recalculada.`)) {
      return;
    }
    run(() => excluirPagamento(p.id), { successMsg: "Pagamento excluído — saldo atualizado." });
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h4>
      <ul className="divide-y divide-slate-200">
        {pagamentos.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-2 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-slate-800">
                {LABEL_TIPO_PAGAMENTO[p.tipo] ?? p.tipo}
                {p.extrato_transacao_id && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700" title="Conferido com o extrato do banco">
                    <BadgeCheck className="h-3 w-3" /> Conciliado
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {formatDate(p.data_pagamento)}
                {p.forma_pagamento ? ` • ${p.forma_pagamento}` : ""}
                {mostrarConta && p.contaNome ? ` • ${p.contaNome}` : ""}
                {Number(p.taxa) > 0 ? ` • taxa ${formatCurrency(Number(p.taxa))}` : ""}
              </p>
              {p.observacao && <p className="truncate text-xs text-slate-400">{p.observacao}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`font-semibold ${tipoLancamento === "receita" ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(Number(p.valor))}
              </span>
              {p.podeEditar && !p.extrato_transacao_id && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditando(p)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    title="Editar pagamento"
                    disabled={pending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(p)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Excluir pagamento"
                    disabled={pending}
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-xs text-slate-600">
        <span>
          Total: <strong>{formatCurrency(total)}</strong>
        </span>
        {taxas > 0 && <span>Líquido (sem taxas): {formatCurrency(total - taxas)}</span>}
      </p>

      {editando && (
        <EditarPagamentoModal
          pagamento={editando}
          contas={mostrarConta ? contas : undefined}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function EditarPagamentoModal({
  pagamento,
  contas,
  onClose,
}: {
  pagamento: PagamentoLinha;
  contas?: ContaOpcao[];
  onClose: () => void;
}) {
  const { run, pending } = useAction();
  const hoje = hojeYmdLocal();
  const ehOs = Boolean(pagamento.os_id);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => editarPagamento(pagamento.id, fd), {
      successMsg: "Pagamento atualizado — saldo recalculado.",
      onSuccess: onClose,
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="card my-8 w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Editar pagamento</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$)</label>
              <input name="valor" type="number" step="0.01" min="0.01" required className="input" defaultValue={Number(pagamento.valor).toFixed(2)} />
            </div>
            <div>
              <label className="label">Data</label>
              <input name="data_pagamento" type="date" max={hoje} required className="input" defaultValue={pagamento.data_pagamento} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ehOs ? (
              <div>
                <label className="label">Tipo</label>
                <select name="tipo" className="input" defaultValue={pagamento.tipo}>
                  {TIPOS_OS.map((t) => (
                    <option key={t} value={t}>
                      {LABEL_TIPO_PAGAMENTO[t]}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="tipo" value={pagamento.tipo} />
            )}
            <div className={ehOs ? "" : "col-span-2"}>
              <label className="label">Forma</label>
              <select name="forma_pagamento" className="input" defaultValue={pagamento.forma_pagamento ?? ""}>
                <option value="">-</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          {contas && contas.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Conta</label>
                <select name="conta_id" className="input" defaultValue={pagamento.conta_id ?? ""}>
                  <option value="">Automática (pela forma)</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Taxa (R$)</label>
                <input name="taxa" type="number" step="0.01" min="0" className="input" defaultValue={Number(pagamento.taxa || 0).toFixed(2)} />
              </div>
            </div>
          )}
          <input name="observacao" className="input" placeholder="Observação" defaultValue={pagamento.observacao ?? ""} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
