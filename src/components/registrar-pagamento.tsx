"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, HandCoins, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useToast } from "./toast";

function mensagemErro(err: unknown): string {
  const digest = (err as { digest?: string })?.digest;
  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
    throw err;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Erro ao registrar pagamento.";
}

export function RegistrarPagamento({
  lancamento,
  action,
}: {
  lancamento: { id: string; descricao: string; valor: number; valor_pago: number; juros: number; multa: number };
  action: (formData: FormData) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const devido = Number(lancamento.valor) + Number(lancamento.juros) + Number(lancamento.multa);
  const saldo = Math.max(0, Math.round((devido - Number(lancamento.valor_pago)) * 100) / 100);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await action(fd);
        toast.push("Pagamento registrado.", "success");
        setAberto(false);
        router.refresh();
      } catch (err) {
        toast.push(mensagemErro(err), "error");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="rounded p-1.5 text-green-600 hover:bg-green-50"
        title="Registrar pagamento"
      >
        <HandCoins className="h-4 w-4" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card my-8 w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Registrar pagamento</h3>
              <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-800">{lancamento.descricao}</p>
              <div className="mt-1 flex justify-between text-slate-500">
                <span>Valor: {formatCurrency(lancamento.valor)}</span>
                <span>Já pago: {formatCurrency(lancamento.valor_pago)}</span>
              </div>
              <p className="mt-1 font-semibold text-brand-700">Saldo devedor: {formatCurrency(saldo)}</p>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">Valor pago agora (R$)</label>
                <input name="valor" type="number" step="0.01" min="0" defaultValue={saldo.toFixed(2)} required className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Juros (R$)</label>
                  <input name="juros" type="number" step="0.01" min="0" defaultValue={0} className="input" />
                </div>
                <div>
                  <label className="label">Multa (R$)</label>
                  <input name="multa" type="number" step="0.01" min="0" defaultValue={0} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Data</label>
                  <input name="data_pagamento" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <label className="label">Forma</label>
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
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setAberto(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
