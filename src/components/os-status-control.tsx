"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { STATUS_OS_LABEL, formatCurrency, parseNumForm } from "@/lib/format";
import { calcValorSinal } from "@/lib/os-pagamentos";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";

export function OsStatusControl({
  statusAtual,
  action,
  transicoesPermitidas = [],
  saldoRestante = 0,
  percentualSinalPadrao = 50,
  aprovado = false,
}: {
  statusAtual: string;
  action: (formData: FormData) => Promise<ActionResult>;
  transicoesPermitidas?: string[];
  saldoRestante?: number;
  percentualSinalPadrao?: number;
  aprovado?: boolean;
}) {
  const opcoes = transicoesPermitidas.length > 0 ? transicoesPermitidas : [statusAtual];
  const [status, setStatus] = useState(statusAtual);
  const [obs, setObs] = useState("");
  const [clientePagou, setClientePagou] = useState(false);
  const [valorRecebido, setValorRecebido] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const { run, pending } = useAction();

  const indoParaPeca = status === "aguardando_peca" && status !== statusAtual;
  const podePagamentoPeca = indoParaPeca && aprovado && saldoRestante > 0;
  const valorSinal = calcValorSinal(saldoRestante, percentualSinalPadrao);
  const valor30 = calcValorSinal(saldoRestante, 30);
  const valor50 = calcValorSinal(saldoRestante, 50);

  useEffect(() => {
    setStatus(statusAtual);
  }, [statusAtual]);

  useEffect(() => {
    if (!indoParaPeca) {
      setClientePagou(false);
      setValorRecebido("");
    }
  }, [indoParaPeca]);

  function handle() {
    const fd = new FormData();
    fd.set("status", status);
    fd.set("observacao", obs);
    if (podePagamentoPeca && clientePagou) {
      const valor = parseNumForm(valorRecebido || null);
      if (valor > 0) {
        fd.set("registrar_pagamento_peca", "on");
        fd.set("valor_recebido", valorRecebido);
        fd.set("forma_pagamento", formaPagamento);
      }
    }
    run(() => action(fd), {
      successMsg: "Status atualizado.",
      onSuccess: () => {
        setObs("");
        setClientePagou(false);
        setValorRecebido("");
      },
    });
  }

  if (transicoesPermitidas.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nenhuma alteração de status disponível para seu perfil nesta etapa.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value={statusAtual}>{STATUS_OS_LABEL[statusAtual] ?? statusAtual} (atual)</option>
        {opcoes
          .filter((k) => k !== statusAtual)
          .map((k) => (
            <option key={k} value={k}>
              {STATUS_OS_LABEL[k] ?? k}
            </option>
          ))}
      </select>
      <input
        className="input"
        placeholder="Observação (opcional)"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
      />

      {indoParaPeca && !aprovado && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Orçamento ainda não aprovado — a OS ficará{" "}
          <strong>aguardando aprovação</strong>. Registre o pagamento depois, quando o cliente autorizar.
        </p>
      )}

      {podePagamentoPeca && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 space-y-2">
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={clientePagou}
              onChange={(e) => setClientePagou(e.target.checked)}
            />
            <span>Cliente pagou agora (entrada / sinal da peça) — opcional</span>
          </label>
          {clientePagou && (
            <>
              <div className="flex flex-wrap gap-1">
                {percentualSinalPadrao > 0 && valorSinal > 0 && (
                  <button
                    type="button"
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200"
                    onClick={() => setValorRecebido(String(valorSinal))}
                  >
                    {percentualSinalPadrao}% ({formatCurrency(valorSinal)})
                  </button>
                )}
                {valor30 > 0 && (
                  <button
                    type="button"
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200"
                    onClick={() => setValorRecebido(String(valor30))}
                  >
                    30% ({formatCurrency(valor30)})
                  </button>
                )}
                {valor50 > 0 && (
                  <button
                    type="button"
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200"
                    onClick={() => setValorRecebido(String(valor50))}
                  >
                    50% ({formatCurrency(valor50)})
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200"
                  onClick={() => setValorRecebido(String(saldoRestante))}
                >
                  Saldo ({formatCurrency(saldoRestante)})
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={saldoRestante}
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                  className="input py-1.5 text-sm"
                  placeholder="Valor (R$)"
                />
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="input py-1.5 text-sm"
                >
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={handle}
        disabled={pending || status === statusAtual}
        className="btn-primary w-full"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Atualizar status
      </button>
    </div>
  );
}
