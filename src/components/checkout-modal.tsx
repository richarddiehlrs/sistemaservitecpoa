"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { obterPosicaoGps } from "@/lib/geo";
import { amanhaYmdLocal, formatCurrency, hojeYmdLocal, parseNumForm } from "@/lib/format";
import { useToast } from "@/components/toast";
import type { OsResumoCheckout } from "@/lib/os-valores";
import type { ActionResult } from "@/lib/action-result";

type Resultado = "visita" | "servico_concluido" | "aguardando_peca";

export function CheckoutModal({
  open,
  onClose,
  onConfirm,
  pending,
  permitirRetorno = false,
  osResumo = null,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (fd: FormData) => Promise<ActionResult>;
  pending: boolean;
  permitirRetorno?: boolean;
  osResumo?: OsResumoCheckout | null;
}) {
  const [resultado, setResultado] = useState<Resultado>("visita");
  const [visitaCobrada, setVisitaCobrada] = useState(false);
  const [clientePagou, setClientePagou] = useState(false);
  const [valorRecebido, setValorRecebido] = useState("");
  const [agendarRetorno, setAgendarRetorno] = useState(false);
  const [retornoData, setRetornoData] = useState(amanhaYmdLocal);
  const [retornoTurno, setRetornoTurno] = useState<"manha" | "tarde" | "dia">("manha");
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setResultado("visita");
    setVisitaCobrada(Boolean(osResumo?.abaterVisita));
    setClientePagou(false);
    setValorRecebido(
      osResumo && osResumo.saldoCliente > 0 ? String(osResumo.saldoCliente) : ""
    );
    setAgendarRetorno(false);
    setRetornoData(amanhaYmdLocal);
    setRetornoTurno("manha");
  }, [open, osResumo]);

  if (!open) return null;

  const mostraRetorno =
    permitirRetorno && (resultado === "visita" || resultado === "aguardando_peca");

  const saldoExibicao = osResumo?.saldoCliente ?? 0;
  const faturamentoExibicao = osResumo?.faturamento ?? 0;

  async function confirmar() {
    const fd = new FormData();
    fd.set("resultado", resultado);
    if (visitaCobrada) fd.set("visita_cobrada", "on");
    if (resultado === "servico_concluido" && clientePagou) {
      fd.set("cliente_pagou_agora", "on");
      const valor = parseNumForm(valorRecebido || null);
      if (valor > 0) fd.set("valor_recebido", String(valor));
    }
    if (mostraRetorno && agendarRetorno && retornoData) {
      fd.set("agendar_retorno", "on");
      fd.set("retorno_data", retornoData);
      fd.set("retorno_turno", retornoTurno);
    }
    try {
      const pos = await obterPosicaoGps();
      fd.set("lat", String(pos.lat));
      fd.set("lng", String(pos.lng));
      fd.set("precisao", String(pos.precisao));
    } catch {
      // segue sem GPS
    }
    const res = await onConfirm(fd);
    if (!res.ok) {
      toast.push(res.error || "Erro ao finalizar visita.", "error");
      return;
    }
    onClose();
  }

  const hoje = hojeYmdLocal();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Finalizar visita</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Informe o que foi feito nesta visita. Isso define o próximo passo da ordem de serviço.
        </p>

        {osResumo && (osResumo.faturamento > 0 || osResumo.retornoGarantia) && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {osResumo.retornoGarantia ? (
              <p>
                <strong className="text-orange-800">Retorno em garantia</strong> — custo vira prejuízo.
                Informe abaixo o que o cliente pagou (deixe 0 se gratuito).
              </p>
            ) : (
              <>
                <p>
                  Faturamento:{" "}
                  <strong className="text-slate-900">{formatCurrency(faturamentoExibicao)}</strong>
                </p>
                {osResumo.abaterVisita && osResumo.valorVisita > 0 && (
                  <p className="mt-1">
                    Visita abatida: {formatCurrency(osResumo.valorVisita)} • Saldo cliente:{" "}
                    <strong className="text-slate-900">{formatCurrency(saldoExibicao)}</strong>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="radio"
              name="resultado"
              checked={resultado === "visita"}
              onChange={() => setResultado("visita")}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-slate-900">Visita / diagnóstico</p>
              <p className="text-xs text-slate-500">
                Cobrou visita ou avaliou o problema — retorno para executar o serviço
              </p>
              {resultado === "visita" && osResumo && osResumo.valorVisita > 0 && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={visitaCobrada}
                    onChange={(e) => setVisitaCobrada(e.target.checked)}
                  />
                  Cliente já pagou a visita ({formatCurrency(osResumo.valorVisita)}) — abate do reparo
                </label>
              )}
              {resultado === "visita" && (!osResumo || osResumo.valorVisita <= 0) && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={visitaCobrada}
                    onChange={(e) => setVisitaCobrada(e.target.checked)}
                  />
                  Cliente já pagou a visita (abate do total do reparo)
                </label>
              )}
            </div>
          </label>

          <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="radio"
              name="resultado"
              checked={resultado === "servico_concluido"}
              onChange={() => setResultado("servico_concluido")}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">Serviço executado</p>
              <p className="text-xs text-slate-500">
                Reparo concluído nesta visita — conclui a OS se o orçamento já estiver aprovado
              </p>
              {resultado === "servico_concluido" && (
                <>
                  <p className="mt-1 text-[10px] text-amber-700">
                    Sem aprovação do cliente, a OS vai para aguardando aprovação (não conclui).
                  </p>
                  {osResumo && osResumo.valorVisita > 0 && (
                    <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={visitaCobrada}
                        onChange={(e) => setVisitaCobrada(e.target.checked)}
                      />
                      <span>
                        Visita já paga ({formatCurrency(osResumo.valorVisita)}) — abatida do total
                      </span>
                    </label>
                  )}
                  <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={clientePagou}
                      onChange={(e) => setClientePagou(e.target.checked)}
                    />
                    <span>Cliente pagou nesta visita (registra no caixa)</span>
                  </label>
                  {clientePagou && (
                    <div className="mt-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        Valor recebido agora
                        {osResumo?.retornoGarantia ? (
                          <span className="font-normal text-slate-400"> — 0 se garantia sem cobrança</span>
                        ) : (
                          saldoExibicao > 0 && (
                            <span className="font-normal text-slate-400">
                              {" "}
                              — saldo {formatCurrency(saldoExibicao)}
                            </span>
                          )
                        )}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valorRecebido}
                        onChange={(e) => setValorRecebido(e.target.value)}
                        className="input py-1.5 text-sm"
                        placeholder={
                          osResumo?.retornoGarantia
                            ? "0,00"
                            : saldoExibicao > 0
                              ? String(saldoExibicao)
                              : "0,00"
                        }
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </label>

          <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <input
              type="radio"
              name="resultado"
              checked={resultado === "aguardando_peca"}
              onChange={() => setResultado("aguardando_peca")}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-slate-900">Aguardando peça</p>
              <p className="text-xs text-slate-500">Precisa de peça para continuar o serviço</p>
            </div>
          </label>
        </div>

        {mostraRetorno && (
          <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={agendarRetorno}
                onChange={(e) => setAgendarRetorno(e.target.checked)}
              />
              Agendar retorno agora
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Desmarcado: retorno fica sem data — você define depois no ERP ou na agenda.
            </p>
            {agendarRetorno && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Data</label>
                  <input
                    type="date"
                    value={retornoData}
                    min={hoje}
                    onChange={(e) => setRetornoData(e.target.value)}
                    className="input py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Turno</label>
                  <select
                    value={retornoTurno}
                    onChange={(e) => setRetornoTurno(e.target.value as typeof retornoTurno)}
                    className="input py-1.5 text-sm"
                  >
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="dia">Dia inteiro</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={pending}>
            Cancelar
          </button>
          <button type="button" onClick={confirmar} className="btn-primary flex-1" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar check-out"}
          </button>
        </div>
      </div>
    </div>
  );
}
