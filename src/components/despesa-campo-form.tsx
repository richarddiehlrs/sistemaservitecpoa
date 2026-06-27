"use client";

import { useState } from "react";
import { Loader2, Plus, X, Fuel, Utensils, Car, Wrench, Receipt } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";

const TIPOS = [
  { id: "combustivel", label: "Combustível", icon: Fuel },
  { id: "alimentacao", label: "Alimentação", icon: Utensils },
  { id: "estacionamento", label: "Estacionamento", icon: Car },
  { id: "ferramenta", label: "Ferramenta", icon: Wrench },
  { id: "outro", label: "Outro", icon: Receipt },
];

export function DespesaCampoForm({
  action,
  osOpcoes = [],
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  osOpcoes?: { id: string; label: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("combustivel");
  const { run, pending } = useAction();

  function handle(formData: FormData) {
    formData.set("tipo_despesa", tipo);
    run(() => action(formData), {
      successMsg: "Despesa registrada! Aparece no financeiro para aprovação.",
      onSuccess: () => setAberto(false),
    });
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn-primary w-full sm:w-auto">
        <Plus className="h-4 w-4" /> Registrar despesa
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="card w-full max-w-md p-5 animate-fade-in-up">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Despesa de campo</h3>
          <button onClick={() => setAberto(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {TIPOS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition ${
                  tipo === t.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"
                }`}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <form action={handle} className="space-y-3">
          <div>
            <label className="label">Valor (R$) *</label>
            <input name="valor" type="number" step="0.01" min="0.01" required className="input text-lg" placeholder="0,00" />
          </div>
          {osOpcoes.length > 0 && (
            <div>
              <label className="label">Vincular à OS (opcional)</label>
              <select name="os_id" className="input">
                <option value="">— Nenhuma —</option>
                {osOpcoes.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Observação</label>
            <input name="observacoes" className="input" placeholder="Ex: abastecimento ida/volta cliente" />
          </div>
          <p className="text-xs text-slate-400">
            A despesa entra automaticamente no Financeiro como &quot;a pagar&quot; para reembolso.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAberto(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={pending} className="btn-primary flex-1">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
