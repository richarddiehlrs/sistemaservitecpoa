"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCheck, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, hojeYmdLocal } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";
import { useAction } from "./use-action";
import { baixarTitulos, encerrarTitulos } from "@/app/(app)/financeiro/pendencias/actions";

export type PendenciaItem = {
  id: string;
  descricao: string;
  cliente: string | null;
  saldo: number;
  pago: number;
  vencimento: string | null;
  osNumero: string | null;
  osId: string | null;
  osStatus: string | null;
  osConclusao: string | null;
  diasAtraso: number;
};

export function PendenciasLista({
  titulo,
  tipo,
  itens,
}: {
  titulo: string;
  tipo: "receita" | "despesa";
  itens: PendenciaItem[];
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [modo, setModo] = useState<null | "baixar" | "encerrar">(null);
  const { run, pending } = useAction();
  const hoje = hojeYmdLocal();
  const total = useMemo(() => itens.filter((i) => sel.includes(i.id)).reduce((s, i) => s + i.saldo, 0), [itens, sel]);
  const receber = tipo === "receita";

  if (!itens.length) return null;

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    sel.forEach((id) => fd.append("ids", id));
    if (modo === "baixar") {
      run(() => baixarTitulos(fd), {
        successMsg: `${sel.length} título(s) baixado(s) — saldos atualizados.`,
        onSuccess: () => {
          setSel([]);
          setModo(null);
        },
      });
    } else {
      run(() => encerrarTitulos(fd), {
        successMsg: `${sel.length} título(s) encerrado(s).`,
        onSuccess: () => {
          setSel([]);
          setModo(null);
        },
      });
    }
  }

  return (
    <div className="card mb-4 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">
          {titulo} <span className="text-sm font-normal text-slate-500">({itens.length})</span>
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={sel.length === itens.length}
            onChange={(e) => setSel(e.target.checked ? itens.map((i) => i.id) : [])}
          />
          Selecionar todos
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="table-base text-sm">
          <thead>
            <tr>
              <th className="w-8" />
              <th>Venceu</th>
              <th>Título</th>
              {receber && <th>OS</th>}
              <th className="text-right">Já pago</th>
              <th className="text-right">Em aberto</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className={sel.includes(i.id) ? "bg-brand-50/50" : ""}>
                <td>
                  <input
                    type="checkbox"
                    checked={sel.includes(i.id)}
                    onChange={(e) => setSel((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))}
                  />
                </td>
                <td className="whitespace-nowrap">
                  {i.vencimento ? formatDate(i.vencimento) : "-"}
                  <span className="block text-[10px] text-red-600">{i.diasAtraso} dias</span>
                </td>
                <td>
                  <Link href={`/financeiro/lancamentos/${i.id}`} className="font-medium hover:underline">
                    {i.descricao}
                  </Link>
                  {i.cliente && <span className="block text-xs text-slate-400">{i.cliente}</span>}
                </td>
                {receber && (
                  <td className="text-xs">
                    {i.osId ? (
                      <Link href={`/ordens/${i.osId}`} className="hover:underline">
                        {i.osNumero} • {i.osStatus}
                        {i.osConclusao && <span className="block text-slate-400">concluída {formatDate(i.osConclusao)}</span>}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                )}
                <td className="text-right text-slate-500">{i.pago > 0 ? formatCurrency(i.pago) : "—"}</td>
                <td className={`text-right font-semibold ${receber ? "text-green-700" : "text-red-700"}`}>{formatCurrency(i.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel.length > 0 && (
        <div className="sticky bottom-2 mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <strong>{sel.length}</strong> selecionado(s) • {formatCurrency(total)}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={() => setModo("baixar")}>
                <CheckCheck className="h-4 w-4" /> {receber ? "Já foi recebido" : "Já foi pago"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setModo("encerrar")}>
                <Ban className="h-4 w-4" /> {receber ? "Não será cobrado" : "Não será pago"}
              </button>
            </div>
          </div>

          {modo && (
            <form onSubmit={enviar} className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-4">
              {modo === "baixar" ? (
                <>
                  <div>
                    <label className="label text-xs">Data do pagamento</label>
                    <select name="modo_data" className="input py-1.5 text-sm" defaultValue={receber ? "conclusao" : "vencimento"}>
                      {receber && <option value="conclusao">Data de conclusão da OS</option>}
                      <option value="vencimento">Data de vencimento</option>
                      <option value="fixa">Uma data só →</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Data (se “uma data só”)</label>
                    <input name="data" type="date" max={hoje} defaultValue={hoje} className="input py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="label text-xs">Forma</label>
                    <select name="forma_pagamento" className="input py-1.5 text-sm" defaultValue="">
                      <option value="">Manter a do título</option>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-3">
                  <label className="label text-xs">Motivo</label>
                  <input
                    name="motivo"
                    className="input py-1.5 text-sm"
                    placeholder={receber ? "Ex.: cliente não pagou / desconto / lançamento duplicado" : "Ex.: lançado em duplicidade"}
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Sem pagamento: o título é cancelado. Com pagamento parcial: o valor é reduzido ao que já foi pago.
                  </p>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setModo(null)}>
                  Voltar
                </button>
                <button type="submit" className="btn-primary" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
