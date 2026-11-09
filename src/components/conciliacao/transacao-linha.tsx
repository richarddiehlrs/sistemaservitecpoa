"use client";

import { useState } from "react";
import { Ban, Check, Link2, Loader2, Plus, Undo2, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAction } from "../use-action";
import {
  conciliarTransacao,
  criarLancamentoDaTransacao,
  desfazerConciliacao,
  ignorarTransacao,
} from "@/app/(app)/financeiro/conciliacao/actions";

export type CandidatoView = {
  id: string;
  valor: number;
  data: string;
  descricao: string;
  forma: string | null;
};

export type SugestaoView = {
  pagamentoIds: string[];
  soma: number;
  diferenca: number;
  motivo: string;
};

export type TransacaoView = {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  documento: string | null;
  status: "pendente" | "conciliado" | "ignorado";
  observacao: string | null;
  vinculados: { descricao: string; valor: number; data: string; lancamentoId: string | null }[];
  taxaAjuste: number;
};

export function TransacaoLinha({
  tx,
  sugestoes,
  candidatos,
  categorias,
  maquininha,
}: {
  tx: TransacaoView;
  sugestoes: SugestaoView[];
  candidatos: CandidatoView[];
  categorias: { id: string; nome: string; tipo: string }[];
  maquininha: boolean;
}) {
  const { run, pending } = useAction();
  const [modo, setModo] = useState<null | "manual" | "criar" | "ignorar">(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const entrada = tx.valor > 0;
  const nomesCand = new Map(candidatos.map((c) => [c.id, c]));

  const somaSel = selecionados.reduce((s, id) => s + (nomesCand.get(id)?.valor ?? 0), 0);
  const difSel = Math.round((somaSel - Math.abs(tx.valor)) * 100) / 100;

  function conciliar(ids: string[], comoTaxa: boolean) {
    run(() => conciliarTransacao(tx.id, ids, comoTaxa), {
      successMsg: comoTaxa ? "Conciliado — diferença registrada como taxa." : "Conciliado.",
      onSuccess: () => {
        setModo(null);
        setSelecionados([]);
      },
    });
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{tx.descricao || "—"}</p>
          <p className="text-xs text-slate-500">
            {formatDate(tx.data)}
            {tx.documento ? ` • doc ${tx.documento}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${entrada ? "text-green-700" : "text-red-700"}`}>{formatCurrency(tx.valor)}</span>
          {tx.status === "conciliado" && <span className="badge bg-emerald-100 text-emerald-700">Conciliado</span>}
          {tx.status === "ignorado" && <span className="badge bg-slate-100 text-slate-500">Ignorado</span>}
          {tx.status === "pendente" && <span className="badge bg-amber-100 text-amber-700">Pendente</span>}
        </div>
      </div>

      {tx.status !== "pendente" && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
          <div>
            {tx.status === "ignorado" && <span>{tx.observacao}</span>}
            {tx.vinculados.map((v, i) => (
              <span key={i} className="mr-3">
                ↳ {v.lancamentoId ? <a className="hover:underline" href={`/financeiro/lancamentos/${v.lancamentoId}`}>{v.descricao}</a> : v.descricao} •{" "}
                {formatDate(v.data)} • {formatCurrency(v.valor)}
              </span>
            ))}
            {tx.taxaAjuste > 0 && <span className="text-amber-700">taxa registrada {formatCurrency(tx.taxaAjuste)}</span>}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
            disabled={pending}
            onClick={() => run(() => desfazerConciliacao(tx.id), { successMsg: "Conciliação desfeita." })}
          >
            <Undo2 className="h-3.5 w-3.5" /> Desfazer
          </button>
        </div>
      )}

      {tx.status === "pendente" && (
        <div className="mt-2 space-y-1.5">
          {sugestoes.map((s) => (
            <div
              key={s.pagamentoIds.join(",")}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-200 bg-emerald-50/60 px-2 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <span className="font-semibold text-emerald-800">Sugestão:</span>{" "}
                {s.pagamentoIds
                  .map((id) => nomesCand.get(id))
                  .filter(Boolean)
                  .map((c) => `${c!.descricao} (${formatDate(c!.data)}, ${formatCurrency(c!.valor)})`)
                  .join(" + ")}{" "}
                <span className="text-slate-500">— {s.motivo}</span>
              </div>
              <button
                type="button"
                className="btn-primary py-1 text-xs"
                disabled={pending}
                onClick={() => conciliar(s.pagamentoIds, s.diferenca > 0)}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {s.diferenca > 0 ? `Conciliar (taxa ${formatCurrency(s.diferenca)})` : "Conciliar"}
              </button>
            </div>
          ))}

          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setModo(modo === "manual" ? null : "manual")}>
              <Link2 className="h-3.5 w-3.5" /> Escolher pagamento(s)
            </button>
            <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setModo(modo === "criar" ? null : "criar")}>
              <Plus className="h-3.5 w-3.5" /> Criar lançamento
            </button>
            <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setModo(modo === "ignorar" ? null : "ignorar")}>
              <Ban className="h-3.5 w-3.5" /> Ignorar
            </button>
          </div>

          {modo === "manual" && (
            <div className="rounded border border-slate-200 p-2">
              {candidatos.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhum {entrada ? "recebimento" : "pagamento"} sem conciliação perto desta data. Lance o pagamento no título
                  ou use “Criar lançamento”.
                </p>
              ) : (
                <>
                  <ul className="max-h-56 space-y-1 overflow-auto text-xs">
                    {candidatos.map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selecionados.includes(c.id)}
                            onChange={(e) =>
                              setSelecionados((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))
                            }
                          />
                          <span className="flex-1">
                            {c.descricao} • {formatDate(c.data)}
                            {c.forma ? ` • ${c.forma}` : ""}
                          </span>
                          <strong>{formatCurrency(c.valor)}</strong>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
                    <span>
                      Selecionado {formatCurrency(somaSel)} •{" "}
                      {Math.abs(difSel) < 0.01 ? (
                        <strong className="text-emerald-700">bate com o banco</strong>
                      ) : (
                        <strong className="text-amber-700">diferença {formatCurrency(difSel)}</strong>
                      )}
                    </span>
                    <div className="flex gap-1.5">
                      {difSel > 0.009 && entrada && (
                        <button type="button" className="btn-secondary py-1 text-xs" disabled={pending} onClick={() => conciliar(selecionados, true)}>
                          Conciliar com taxa {maquininha ? "da maquininha" : ""}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-primary py-1 text-xs"
                        disabled={pending || !selecionados.length || Math.abs(difSel) >= 0.01}
                        onClick={() => conciliar(selecionados, false)}
                      >
                        Conciliar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {modo === "criar" && (
            <FormInline
              onCancel={() => setModo(null)}
              pending={pending}
              onSubmit={(fd) =>
                run(() => criarLancamentoDaTransacao(tx.id, fd), {
                  successMsg: "Lançamento criado e conciliado.",
                  onSuccess: () => setModo(null),
                })
              }
            >
              <input name="descricao" className="input py-1 text-xs" defaultValue={tx.descricao} required />
              <select name="categoria_id" className="input py-1 text-xs" defaultValue="">
                <option value="">Categoria…</option>
                {categorias
                  .filter((c) => c.tipo === (entrada ? "receita" : "despesa"))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </FormInline>
          )}

          {modo === "ignorar" && (
            <FormInline
              onCancel={() => setModo(null)}
              pending={pending}
              onSubmit={(fd) =>
                run(() => ignorarTransacao(tx.id, fd), { successMsg: "Transação ignorada.", onSuccess: () => setModo(null) })
              }
            >
              <input
                name="observacao"
                className="input py-1 text-xs sm:col-span-2"
                placeholder="Motivo (ex.: transferência entre contas, aplicação)"
              />
            </FormInline>
          )}
        </div>
      )}
    </li>
  );
}

function FormInline({
  children,
  onSubmit,
  onCancel,
  pending,
}: {
  children: React.ReactNode;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <form
      className="grid gap-1.5 rounded border border-slate-200 p-2 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {children}
      <div className="flex gap-1">
        <button type="button" className="btn-secondary py-1 text-xs" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </button>
        <button type="submit" className="btn-primary py-1 text-xs" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Confirmar
        </button>
      </div>
    </form>
  );
}
