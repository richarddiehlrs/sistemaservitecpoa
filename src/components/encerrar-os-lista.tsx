"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCheck, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, formatNumeroOS, STATUS_OS_LABEL } from "@/lib/format";
import { useAction } from "./use-action";
import { encerrarOsAntigas } from "@/app/(app)/manutencao/actions";

export type OsAntiga = {
  id: string;
  numero: number;
  cliente: string;
  status: string;
  abertura: string | null;
  aprovacao: string | null;
  total: number;
  pago: number;
};

export function EncerrarOsLista({ itens }: { itens: OsAntiga[] }) {
  const [sel, setSel] = useState<string[]>([]);
  const { run, pending } = useAction();
  const total = useMemo(() => itens.filter((i) => sel.includes(i.id)).reduce((s, i) => s + i.total, 0), [itens, sel]);

  function encerrar(modo: "feita" | "nao_feita") {
    const texto =
      modo === "feita"
        ? `Encerrar ${sel.length} OS como "já realizadas"? Elas vão para Entregue e as receitas sem pagamento são canceladas (nenhum faturamento ou pagamento é criado).`
        : `Cancelar ${sel.length} OS como "não realizadas"?`;
    if (!window.confirm(texto)) return;
    const fd = new FormData();
    sel.forEach((id) => fd.append("ids", id));
    fd.set("modo", modo);
    run(() => encerrarOsAntigas(fd), {
      successMsg: `${sel.length} OS encerrada(s).`,
      onSuccess: () => setSel([]),
    });
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={sel.length === itens.length && itens.length > 0}
            onChange={(e) => setSel(e.target.checked ? itens.map((i) => i.id) : [])}
          />
          Selecionar todas ({itens.length})
        </label>
        {sel.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">
              {sel.length} selecionada(s) • {formatCurrency(total)}
            </span>
            <button type="button" className="btn-primary py-1.5 text-sm" disabled={pending} onClick={() => encerrar("feita")}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Já foi feita — encerrar
            </button>
            <button type="button" className="btn-secondary py-1.5 text-sm" disabled={pending} onClick={() => encerrar("nao_feita")}>
              <Ban className="h-4 w-4" /> Não foi feita — cancelar
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="table-base text-sm">
          <thead>
            <tr>
              <th className="w-8" />
              <th>OS</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Aprovada / aberta</th>
              <th className="text-right">Valor</th>
              <th className="text-right">Já pago</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((o) => (
              <tr key={o.id} className={sel.includes(o.id) ? "bg-brand-50/50" : ""}>
                <td>
                  <input
                    type="checkbox"
                    checked={sel.includes(o.id)}
                    onChange={(e) => setSel((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))}
                  />
                </td>
                <td>
                  <Link href={`/ordens/${o.id}`} className="font-medium text-brand-700 hover:underline">
                    {formatNumeroOS(o.numero)}
                  </Link>
                </td>
                <td className="max-w-[200px] truncate">{o.cliente}</td>
                <td className="text-xs">{STATUS_OS_LABEL[o.status] ?? o.status}</td>
                <td className="whitespace-nowrap text-xs">
                  {o.aprovacao ? `aprov. ${formatDate(o.aprovacao)}` : o.abertura ? `aberta ${formatDate(o.abertura)}` : "—"}
                </td>
                <td className="text-right">{formatCurrency(o.total)}</td>
                <td className="text-right text-slate-500">{o.pago > 0 ? formatCurrency(o.pago) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
