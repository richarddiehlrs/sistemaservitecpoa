"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { obterPosicaoGps } from "@/lib/geo";

type Resultado = "visita" | "servico_concluido" | "aguardando_peca";

export function CheckoutModal({
  open,
  onClose,
  onConfirm,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (fd: FormData) => Promise<void>;
  pending: boolean;
}) {
  const [resultado, setResultado] = useState<Resultado>("visita");
  const [visitaCobrada, setVisitaCobrada] = useState(false);

  if (!open) return null;

  async function confirmar() {
    const fd = new FormData();
    fd.set("resultado", resultado);
    if (visitaCobrada) fd.set("visita_cobrada", "on");
    try {
      const pos = await obterPosicaoGps();
      fd.set("lat", String(pos.lat));
      fd.set("lng", String(pos.lng));
      fd.set("precisao", String(pos.precisao));
    } catch {
      // segue sem GPS
    }
    await onConfirm(fd);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Finalizar visita</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Informe o que foi feito nesta visita. Isso define o próximo passo da ordem de serviço.
        </p>

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
              {resultado === "visita" && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={visitaCobrada}
                    onChange={(e) => setVisitaCobrada(e.target.checked)}
                  />
                  Cliente já pagou a visita (abate do total do serviço)
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
            <div>
              <p className="font-medium text-slate-900">Serviço executado</p>
              <p className="text-xs text-slate-500">
                Reparo concluído nesta visita — conclui se o orçamento já estiver aprovado
              </p>
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
