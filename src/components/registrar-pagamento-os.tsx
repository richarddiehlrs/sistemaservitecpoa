"use client";

import { useState } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { formatCurrency, parseNumForm } from "@/lib/format";
import { calcValorSinal } from "@/lib/os-pagamentos";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";

export function RegistrarPagamentoOs({
  osId,
  saldoRestante,
  percentualSinalPadrao,
  aprovado,
  action,
  defaultTipo = "sinal",
}: {
  osId: string;
  saldoRestante: number;
  percentualSinalPadrao: number;
  aprovado: boolean;
  action: (osId: string, formData: FormData) => Promise<ActionResult>;
  defaultTipo?: "sinal" | "parcial" | "saldo";
}) {
  const { run, pending } = useAction();
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState(defaultTipo);
  const [forma, setForma] = useState("PIX");

  if (saldoRestante <= 0) return null;

  const valorSinalPadrao = calcValorSinal(saldoRestante, percentualSinalPadrao);
  const valor30 = calcValorSinal(saldoRestante, 30);
  const valor50 = calcValorSinal(saldoRestante, 50);

  function aplicarValor(v: number) {
    setValor(String(Math.round(v * 100) / 100));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = parseNumForm(fd.get("valor"));
    if (v <= 0) return;
    if (tipo === "sinal" && !aprovado) return;
    run(() => action(osId, fd), {
      successMsg: "Pagamento registrado no financeiro.",
      refresh: true,
      onSuccess: () => setValor(""),
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <Banknote className="h-4 w-4" /> Registrar pagamento
      </h4>
      <p className="mb-3 text-xs text-emerald-800">
        Saldo em aberto: <strong>{formatCurrency(saldoRestante)}</strong>
        {aprovado
          ? " — após aprovação do orçamento, registre entrada/sinal ou pagamento parcial."
          : " — sinal disponível após aprovação do cliente."}
      </p>

      <form onSubmit={submit} className="space-y-3">
        <input type="hidden" name="tipo" value={tipo} />
        <div className="flex flex-wrap gap-2">
          {(["sinal", "parcial", "saldo"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tipo === t
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {t === "sinal" ? "Entrada / sinal" : t === "saldo" ? "Saldo final" : "Parcial"}
            </button>
          ))}
        </div>

        {tipo === "sinal" && aprovado && (
          <div className="flex flex-wrap gap-2">
            {percentualSinalPadrao > 0 && percentualSinalPadrao !== 30 && percentualSinalPadrao !== 50 && (
              <button
                type="button"
                className="btn-secondary py-1 text-xs"
                onClick={() => aplicarValor(valorSinalPadrao)}
              >
                {percentualSinalPadrao}% ({formatCurrency(valorSinalPadrao)})
              </button>
            )}
            <button type="button" className="btn-secondary py-1 text-xs" onClick={() => aplicarValor(valor30)}>
              30% ({formatCurrency(valor30)})
            </button>
            <button type="button" className="btn-secondary py-1 text-xs" onClick={() => aplicarValor(valor50)}>
              50% ({formatCurrency(valor50)})
            </button>
            <button type="button" className="btn-secondary py-1 text-xs" onClick={() => aplicarValor(saldoRestante)}>
              100% ({formatCurrency(saldoRestante)})
            </button>
          </div>
        )}

        {tipo !== "sinal" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary py-1 text-xs" onClick={() => aplicarValor(saldoRestante)}>
              Saldo total ({formatCurrency(saldoRestante)})
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Valor (R$)</label>
            <input
              name="valor"
              type="number"
              step="0.01"
              min="0.01"
              max={saldoRestante}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="input py-1.5 text-sm"
              required
              disabled={tipo === "sinal" && !aprovado}
            />
          </div>
          <div>
            <label className="label text-xs">Forma</label>
            <select
              name="forma_pagamento"
              className="input py-1.5 text-sm"
              value={forma}
              onChange={(e) => setForma(e.target.value)}
            >
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <input
          name="observacao"
          className="input py-1.5 text-sm"
          placeholder="Observação (opcional)"
        />

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={pending || (tipo === "sinal" && !aprovado)}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar pagamento"}
        </button>
      </form>
    </div>
  );
}
