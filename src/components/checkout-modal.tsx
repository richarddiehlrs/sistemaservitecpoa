"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { obterPosicaoGps } from "@/lib/geo";
import { amanhaYmdLocal, formatCurrency, hojeYmdLocal, parseNumForm } from "@/lib/format";
import { calcValorSinal } from "@/lib/os-pagamentos";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";
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
  percentualSinalPadrao = 50,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (fd: FormData) => Promise<ActionResult>;
  pending: boolean;
  permitirRetorno?: boolean;
  osResumo?: OsResumoCheckout | null;
  percentualSinalPadrao?: number;
}) {
  const [resultado, setResultado] = useState<Resultado>("visita");
  const [visitaCobrada, setVisitaCobrada] = useState(false);
  const [clientePagou, setClientePagou] = useState(false);
  const [valorRecebido, setValorRecebido] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [agendarRetorno, setAgendarRetorno] = useState(false);
  const [retornoData, setRetornoData] = useState(amanhaYmdLocal);
  const [retornoTurno, setRetornoTurno] = useState<"manha" | "tarde" | "dia">("manha");
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setResultado("visita");
    setVisitaCobrada(Boolean(osResumo?.abaterVisita || osResumo?.visitaPaga));
    setClientePagou(false);
    const saldo = osResumo?.saldoRestante ?? osResumo?.saldoCliente ?? 0;
    setValorRecebido(saldo > 0 ? String(saldo) : "");
    setFormaPagamento("PIX");
    setAgendarRetorno(false);
    setRetornoData(amanhaYmdLocal);
    setRetornoTurno("manha");
  }, [open, osResumo]);

  if (!open) return null;

  const mostraRetorno =
    permitirRetorno && (resultado === "visita" || resultado === "aguardando_peca");

  const saldoExibicao = osResumo?.saldoRestante ?? osResumo?.saldoCliente ?? 0;
  const faturamentoExibicao = osResumo?.faturamento ?? 0;
  const podeRegistrarPagamentoServico =
    resultado === "servico_concluido" && Boolean(osResumo?.aprovado);
  const podeRegistrarSinalVisita =
    resultado === "visita" && Boolean(osResumo?.aprovado) && saldoExibicao > 0;
  const podeRegistrarPagamentoPeca =
    resultado === "aguardando_peca" && Boolean(osResumo?.aprovado) && saldoExibicao > 0;

  function aplicarValor(v: number) {
    setValorRecebido(String(Math.round(v * 100) / 100));
    setClientePagou(true);
  }

  async function confirmar() {
    const fd = new FormData();
    fd.set("resultado", resultado);
    if (visitaCobrada) fd.set("visita_cobrada", "on");
    if (
      (podeRegistrarPagamentoServico ||
        podeRegistrarSinalVisita ||
        podeRegistrarPagamentoPeca) &&
      clientePagou
    ) {
      fd.set("cliente_pagou_agora", "on");
      fd.set("forma_pagamento", formaPagamento);
      const valor = parseNumForm(valorRecebido || null);
      if (valor > 0) fd.set("valor_recebido", String(valor));
      if (podeRegistrarSinalVisita || podeRegistrarPagamentoPeca) {
        fd.set("tipo_pagamento", "sinal");
      }
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
  const valorSinal = calcValorSinal(saldoExibicao, percentualSinalPadrao);
  const valor30 = calcValorSinal(saldoExibicao, 30);
  const valor50 = calcValorSinal(saldoExibicao, 50);

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
          Informe o que foi feito nesta visita. Pagamentos registrados vão direto ao financeiro.
        </p>

        {osResumo && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {osResumo.retornoGarantia ? (
              <p>
                <strong className="text-orange-800">Retorno em garantia</strong> — informe o que o cliente pagou.
              </p>
            ) : (
              <>
                <p>
                  Total cliente:{" "}
                  <strong className="text-slate-900">{formatCurrency(osResumo.saldoCliente)}</strong>
                  {osResumo.valorVisita > 0 && (
                    <span className="text-slate-500">
                      {" "}
                      (visita {formatCurrency(osResumo.valorVisita)}
                      {osResumo.visitaPaga || osResumo.abaterVisita ? " — abatida" : ""})
                    </span>
                  )}
                </p>
                {osResumo.valorPago > 0 && (
                  <p className="mt-1">
                    Já recebido: {formatCurrency(osResumo.valorPago)} • Saldo:{" "}
                    <strong className="text-slate-900">{formatCurrency(saldoExibicao)}</strong>
                  </p>
                )}
                {faturamentoExibicao > 0 && (
                  <p className="mt-1 text-slate-500">Faturamento: {formatCurrency(faturamentoExibicao)}</p>
                )}
                {!osResumo.aprovado && (
                  <p className="mt-1 text-amber-700">Orçamento ainda não aprovado — pagamento do serviço só após aprovação.</p>
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
              <p className="text-xs text-slate-500">Cobrou visita ou avaliou — retorno para executar</p>
              {resultado === "visita" && osResumo && osResumo.valorVisita > 0 && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={visitaCobrada}
                    onChange={(e) => setVisitaCobrada(e.target.checked)}
                  />
                  Cliente pagou a visita ({formatCurrency(osResumo.valorVisita)}) — abate do reparo
                </label>
              )}
              {resultado === "visita" && podeRegistrarSinalVisita && (
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={clientePagou}
                      onChange={(e) => setClientePagou(e.target.checked)}
                    />
                    <span>Registrar entrada / sinal (orçamento aprovado)</span>
                  </label>
                  {clientePagou && (
                    <PagamentoRapido
                      valor={valorRecebido}
                      onValor={setValorRecebido}
                      forma={formaPagamento}
                      onForma={setFormaPagamento}
                      saldo={saldoExibicao}
                      botoes={[
                        { label: `${percentualSinalPadrao}%`, v: valorSinal },
                        { label: "30%", v: valor30 },
                        { label: "50%", v: valor50 },
                        { label: "100%", v: saldoExibicao },
                      ]}
                      onAplicar={aplicarValor}
                    />
                  )}
                </div>
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
              <p className="text-xs text-slate-500">Reparo concluído — conclui a OS se aprovada</p>
              {resultado === "servico_concluido" && (
                <>
                  {!osResumo?.aprovado && (
                    <p className="mt-1 text-[10px] text-amber-700">
                      Sem aprovação, a OS vai para aguardando aprovação (não conclui).
                    </p>
                  )}
                  {osResumo && osResumo.valorVisita > 0 && !osResumo.visitaPaga && (
                    <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={visitaCobrada}
                        onChange={(e) => setVisitaCobrada(e.target.checked)}
                      />
                      <span>Visita ({formatCurrency(osResumo.valorVisita)}) — abatida do total</span>
                    </label>
                  )}
                  {podeRegistrarPagamentoServico && saldoExibicao > 0 && (
                    <>
                      <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={clientePagou}
                          onChange={(e) => setClientePagou(e.target.checked)}
                        />
                        <span>Cliente pagou nesta visita (saldo ou parcial)</span>
                      </label>
                      {clientePagou && (
                        <PagamentoRapido
                          valor={valorRecebido}
                          onValor={setValorRecebido}
                          forma={formaPagamento}
                          onForma={setFormaPagamento}
                          saldo={saldoExibicao}
                          botoes={[
                            { label: "Saldo", v: saldoExibicao },
                            { label: "50%", v: valor50 },
                            { label: "30%", v: valor30 },
                          ]}
                          onAplicar={aplicarValor}
                        />
                      )}
                    </>
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
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">Precisa de peça</p>
              <p className="text-xs text-slate-500">
                Diagnóstico feito — aguarda peça no fornecedor ou aprovação do orçamento pelo cliente
              </p>
              {resultado === "aguardando_peca" && (
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                  {!osResumo?.aprovado ? (
                    <p className="text-[11px] text-amber-700">
                      Orçamento ainda não aprovado — a OS ficará{" "}
                      <strong>aguardando aprovação</strong>. O cliente pode pagar depois (presencial ou
                      portal).
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] text-slate-600">
                        Orçamento aprovado — após pedir a peça, a OS fica{" "}
                        <strong>aguardando peça</strong>.
                      </p>
                      {saldoExibicao > 0 && (
                        <>
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
                            <PagamentoRapido
                              valor={valorRecebido}
                              onValor={setValorRecebido}
                              forma={formaPagamento}
                              onForma={setFormaPagamento}
                              saldo={saldoExibicao}
                              botoes={[
                                ...(percentualSinalPadrao > 0
                                  ? [{ label: `${percentualSinalPadrao}%`, v: valorSinal }]
                                  : []),
                                { label: "30%", v: valor30 },
                                { label: "50%", v: valor50 },
                                { label: "Saldo", v: saldoExibicao },
                              ]}
                              onAplicar={aplicarValor}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                  {osResumo && osResumo.valorVisita > 0 && !osResumo.visitaPaga && (
                    <label className="flex items-start gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={visitaCobrada}
                        onChange={(e) => setVisitaCobrada(e.target.checked)}
                      />
                      <span>
                        Cliente pagou a visita ({formatCurrency(osResumo.valorVisita)}) — abate do reparo
                      </span>
                    </label>
                  )}
                </div>
              )}
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

function PagamentoRapido({
  valor,
  onValor,
  forma,
  onForma,
  saldo,
  botoes,
  onAplicar,
  required = false,
}: {
  valor: string;
  onValor: (v: string) => void;
  forma: string;
  onForma: (v: string) => void;
  saldo: number;
  botoes: { label: string; v: number }[];
  onAplicar: (v: number) => void;
  required?: boolean;
}) {
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1">
        {botoes.map((b) =>
          b.v > 0 ? (
            <button
              key={b.label}
              type="button"
              className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200"
              onClick={() => onAplicar(b.v)}
            >
              {b.label} ({formatCurrency(b.v)})
            </button>
          ) : null
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min="0.01"
          step="0.01"
          max={saldo < 99999 ? saldo : undefined}
          value={valor}
          onChange={(e) => onValor(e.target.value)}
          className="input py-1.5 text-sm"
          placeholder={saldo > 0 && saldo < 99999 ? String(saldo) : "0,00"}
          required={required}
        />
        <select
          value={forma}
          onChange={(e) => onForma(e.target.value)}
          className="input py-1.5 text-sm"
        >
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
