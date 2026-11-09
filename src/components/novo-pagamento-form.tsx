"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { formatCurrency, hojeYmdLocal } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";
import { LABEL_TIPO_PAGAMENTO, type TipoPagamentoOs } from "@/lib/os-pagamentos";
import { registrarPagamentoLancamento } from "@/app/(app)/financeiro/pagamentos-actions";
import { useAction } from "./use-action";

/** Formulário inline para lançar mais um pagamento em um título (OS ou avulso). */
export function NovoPagamentoForm({
  lancamentoId,
  saldo,
  contas,
  formaPadrao,
  ehOs,
  receita,
}: {
  lancamentoId: string;
  saldo: number;
  contas: { id: string; nome: string }[];
  formaPadrao?: string | null;
  ehOs: boolean;
  receita: boolean;
}) {
  const { run, pending } = useAction();
  const [valor, setValor] = useState(saldo.toFixed(2));
  const hoje = hojeYmdLocal();
  const tipos: TipoPagamentoOs[] = ehOs ? ["parcial", "sinal", "saldo", "outro"] : ["baixa"];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(() => registrarPagamentoLancamento(fd), {
      successMsg: receita ? "Recebimento lançado — saldo atualizado." : "Pagamento lançado — saldo atualizado.",
      onSuccess: () => form.reset(),
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      <input type="hidden" name="lancamento_id" value={lancamentoId} />
      <p className="flex items-center gap-1 text-sm font-semibold text-emerald-900">
        <Plus className="h-4 w-4" /> Lançar {receita ? "recebimento" : "pagamento"} — em aberto {formatCurrency(saldo)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="label text-xs">Valor (R$)</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="input py-1.5 text-sm"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div>
          <label className="label text-xs">Data</label>
          <input name="data_pagamento" type="date" max={hoje} defaultValue={hoje} className="input py-1.5 text-sm" />
        </div>
        <div>
          <label className="label text-xs">Forma</label>
          <select name="forma_pagamento" className="input py-1.5 text-sm" defaultValue={formaPadrao ?? "PIX"}>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Conta</label>
          <select name="conta_id" className="input py-1.5 text-sm" defaultValue="">
            <option value="">Automática</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tipos.length > 1 ? (
          <div>
            <label className="label text-xs">Tipo</label>
            <select name="tipo" className="input py-1.5 text-sm" defaultValue={tipos[0]}>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {LABEL_TIPO_PAGAMENTO[t]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="tipo" value={tipos[0]} />
        )}
        <div>
          <label className="label text-xs">Taxa retida (R$)</label>
          <input name="taxa" type="number" step="0.01" min="0" defaultValue="0" className="input py-1.5 text-sm" />
        </div>
        <div className={tipos.length > 1 ? "col-span-2" : "col-span-2 sm:col-span-3"}>
          <label className="label text-xs">Observação</label>
          <input name="observacao" className="input py-1.5 text-sm" placeholder="Opcional" />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Lançar
        </button>
      </div>
    </form>
  );
}
