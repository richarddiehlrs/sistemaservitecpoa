"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, FileUp, Loader2, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "../toast";
import {
  importarExtrato,
  previsualizarExtrato,
  type PreviaExtrato,
} from "@/app/(app)/financeiro/conciliacao/actions";

type Linha = PreviaExtrato["transacoes"][number] & { incluir: boolean; repetida: boolean };

export function ImportarExtrato({
  contas,
  contaPadrao,
}: {
  contas: { id: string; nome: string }[];
  contaPadrao?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<PreviaExtrato | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const resumo = useMemo(() => {
    const inc = linhas.filter((l) => l.incluir);
    return {
      qtd: inc.length,
      entradas: inc.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0),
      saidas: inc.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0),
    };
  }, [linhas]);

  function fechar() {
    setAberto(false);
    setPrevia(null);
    setLinhas([]);
  }

  function ler(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await previsualizarExtrato(fd);
      if (!res.ok) {
        toast.push(res.error, "error");
        return;
      }
      const p = res.data!;
      const repetidas = new Set(p.jaImportadas);
      setPrevia(p);
      setLinhas(p.transacoes.map((t) => ({ ...t, repetida: repetidas.has(t.chave), incluir: !repetidas.has(t.chave) })));
    });
  }

  function confirmar() {
    if (!previa) return;
    const escolhidas = linhas.filter((l) => l.incluir).map(({ incluir: _i, repetida: _r, ...t }) => t);
    start(async () => {
      const res = await importarExtrato({
        contaId: previa.contaId,
        arquivoNome: previa.arquivoNome,
        formato: previa.formato,
        periodoInicio: previa.periodoInicio,
        periodoFim: previa.periodoFim,
        saldoFinal: previa.saldoFinal,
        transacoes: escolhidas,
      });
      if (!res.ok) {
        toast.push(res.error, "error");
        return;
      }
      const { inseridas, duplicadas } = res.data!;
      toast.push(
        `${inseridas} transação(ões) importada(s)${duplicadas ? ` • ${duplicadas} já existiam` : ""}.`,
        "success"
      );
      fechar();
      router.refresh();
    });
  }

  function alternarSinal(i: number) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, valor: -l.valor } : l)));
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setAberto(true)}>
        <FileUp className="h-4 w-4" /> Importar extrato
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card my-6 w-full max-w-4xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Importar extrato bancário</h3>
              <button type="button" onClick={fechar} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!previa ? (
              <form onSubmit={ler} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Conta</label>
                    <select name="conta_id" className="input" defaultValue={contaPadrao} required>
                      {contas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Arquivo (OFX, CSV ou PDF)</label>
                    <input name="arquivo" type="file" accept=".ofx,.qfx,.csv,.txt,.pdf" className="input" required />
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Como exportar</p>
                  <p>
                    <strong>Bradesco:</strong> Internet Banking → Saldos e Extratos → Extrato → período → <em>Salvar como OFX</em>{" "}
                    (Money/Quicken). O PDF também funciona, mas exige conferência.
                  </p>
                  <p>
                    <strong>InfinitePay:</strong> app/site → Extrato → Exportar → CSV ou PDF. O sistema usa o valor{" "}
                    <em>líquido</em> (o que caiu na conta).
                  </p>
                  <p>Linhas já importadas antes são reconhecidas e não duplicam.</p>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary" disabled={pending}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Ler arquivo
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                {previa.avisos.map((a) => (
                  <p key={a} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {a}
                  </p>
                ))}
                <p className="text-sm text-slate-600">
                  <strong>{previa.arquivoNome}</strong> ({previa.formato.toUpperCase()}) •{" "}
                  {previa.periodoInicio ? `${formatDate(previa.periodoInicio)} a ${formatDate(previa.periodoFim)}` : "período não informado"}
                  {previa.saldoFinal != null && ` • saldo final ${formatCurrency(previa.saldoFinal)}`}
                </p>
                <div className="max-h-[55vh] overflow-auto rounded-lg ring-1 ring-slate-200">
                  <table className="table text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th className="w-8">
                          <input
                            type="checkbox"
                            checked={linhas.every((l) => l.incluir || l.repetida)}
                            onChange={(e) =>
                              setLinhas((ls) => ls.map((l) => ({ ...l, incluir: e.target.checked && !l.repetida })))
                            }
                          />
                        </th>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th className="text-right">Valor</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l, i) => (
                        <tr key={l.chave} className={l.repetida ? "opacity-40" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              checked={l.incluir}
                              disabled={l.repetida}
                              onChange={(e) =>
                                setLinhas((ls) => ls.map((x, idx) => (idx === i ? { ...x, incluir: e.target.checked } : x)))
                              }
                            />
                          </td>
                          <td className="whitespace-nowrap">{formatDate(l.data)}</td>
                          <td>
                            {l.descricao}
                            {l.repetida && <span className="ml-1 text-[10px] font-semibold uppercase">já importada</span>}
                          </td>
                          <td className={`whitespace-nowrap text-right font-semibold ${l.valor > 0 ? "text-green-700" : "text-red-700"}`}>
                            {formatCurrency(l.valor)}
                          </td>
                          <td>
                            {!l.repetida && (
                              <button
                                type="button"
                                title="Inverter: entrada ↔ saída"
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                onClick={() => alternarSinal(i)}
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-600">
                    {resumo.qtd} linha(s) • entradas <strong className="text-green-700">{formatCurrency(resumo.entradas)}</strong> • saídas{" "}
                    <strong className="text-red-700">{formatCurrency(resumo.saidas)}</strong>
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setPrevia(null)}>
                      Outro arquivo
                    </button>
                    <button type="button" className="btn-primary" onClick={confirmar} disabled={pending || resumo.qtd === 0}>
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Importar {resumo.qtd} linha(s)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
