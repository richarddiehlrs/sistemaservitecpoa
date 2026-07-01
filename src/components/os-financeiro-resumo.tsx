import { formatCurrency, formatDateTime } from "@/lib/format";
import { LABEL_TIPO_PAGAMENTO, type OsPagamentoRow } from "@/lib/os-pagamentos";

export function OsPagamentosHistorico({ pagamentos }: { pagamentos: OsPagamentoRow[] }) {
  if (!pagamentos.length) return null;

  const total = pagamentos.reduce((s, p) => s + Number(p.valor), 0);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Pagamentos recebidos
      </h4>
      <ul className="space-y-2">
        {pagamentos.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
            <div>
              <p className="font-medium text-slate-800">{LABEL_TIPO_PAGAMENTO[p.tipo]}</p>
              <p className="text-xs text-slate-500">
                {formatDateTime(p.created_at)}
                {p.forma_pagamento ? ` • ${p.forma_pagamento}` : ""}
              </p>
              {p.observacao && <p className="text-xs text-slate-400">{p.observacao}</p>}
            </div>
            <span className="shrink-0 font-semibold text-green-700">{formatCurrency(Number(p.valor))}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
        Total recebido (histórico): <strong>{formatCurrency(total)}</strong>
      </p>
    </div>
  );
}

export function OsFinanceiroResumo({
  totalCliente,
  valorPago,
  saldoRestante,
  visitaPaga,
  valorVisita,
  statusReceita,
}: {
  totalCliente: number;
  valorPago: number;
  saldoRestante: number;
  visitaPaga: boolean;
  valorVisita: number;
  statusReceita: string | null;
}) {
  const statusLabel =
    statusReceita === "pago"
      ? "Quitado"
      : statusReceita === "parcial"
        ? "Parcial"
        : statusReceita === "pendente"
          ? "Pendente"
          : "Sem lançamento";

  const statusClass =
    statusReceita === "pago"
      ? "bg-green-100 text-green-800"
      : statusReceita === "parcial"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg bg-slate-50 p-2.5">
        <p className="text-[10px] font-medium uppercase text-slate-400">Total cliente</p>
        <p className="text-sm font-bold text-slate-900">{formatCurrency(totalCliente)}</p>
      </div>
      <div className="rounded-lg bg-green-50 p-2.5">
        <p className="text-[10px] font-medium uppercase text-green-600">Recebido</p>
        <p className="text-sm font-bold text-green-800">{formatCurrency(valorPago)}</p>
      </div>
      <div className="rounded-lg bg-amber-50 p-2.5">
        <p className="text-[10px] font-medium uppercase text-amber-600">Saldo</p>
        <p className="text-sm font-bold text-amber-900">{formatCurrency(saldoRestante)}</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-2.5">
        <p className="text-[10px] font-medium uppercase text-slate-400">Status</p>
        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
          {statusLabel}
        </span>
        {visitaPaga && valorVisita > 0 && (
          <p className="mt-1 text-[10px] text-slate-500">Visita abatida ({formatCurrency(valorVisita)})</p>
        )}
      </div>
    </div>
  );
}
