"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { CategoriaFinanceira } from "@/types/database";

export function LancamentoForm({
  categorias,
  action,
}: {
  categorias: CategoriaFinanceira[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [pending, startTransition] = useTransition();

  const cats = categorias.filter((c) => c.tipo === tipo);

  function handle(formData: FormData) {
    startTransition(async () => {
      await action(formData);
      setAberto(false);
    });
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Novo lançamento
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="card my-8 w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Novo lançamento</h3>
          <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={handle} className="space-y-4">
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
            <button type="button" onClick={() => setTipo("receita")}
              className={`flex-1 rounded-md py-1.5 ${tipo === "receita" ? "bg-green-600 text-white" : "text-slate-600"}`}>
              Receita
            </button>
            <button type="button" onClick={() => setTipo("despesa")}
              className={`flex-1 rounded-md py-1.5 ${tipo === "despesa" ? "bg-red-600 text-white" : "text-slate-600"}`}>
              Despesa
            </button>
          </div>
          <input type="hidden" name="tipo" value={tipo} />

          <div>
            <label className="label">Descrição *</label>
            <input name="descricao" required className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input name="valor" type="number" step="0.01" min="0" required className="input" />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select name="categoria_id" className="input">
                <option value="">-</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Competência</label>
              <input name="data_competencia" type="date" className="input"
                defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="label">Vencimento</label>
              <input name="data_vencimento" type="date" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Situação</label>
              <select name="status" className="input" defaultValue="pendente">
                <option value="pendente">{tipo === "receita" ? "A receber" : "A pagar"}</option>
                <option value="pago">{tipo === "receita" ? "Recebido" : "Pago"}</option>
              </select>
            </div>
            <div>
              <label className="label">Forma de pagamento</label>
              <select name="forma_pagamento" className="input">
                <option value="">-</option>
                <option>Dinheiro</option>
                <option>PIX</option>
                <option>Cartão de débito</option>
                <option>Cartão de crédito</option>
                <option>Boleto</option>
                <option>Transferência</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea name="observacoes" rows={2} className="input" />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} className="btn-secondary">Cancelar</button>
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
