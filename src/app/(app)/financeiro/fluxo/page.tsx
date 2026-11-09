import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Landmark, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { getConfig } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { formatCurrency, formatDate, hojeYmdLocal } from "@/lib/format";
import { saldoEmAberto } from "@/lib/financeiro";
import { extratoMes, projetarFluxo, type MovimentoCaixa, type TituloAberto } from "@/lib/fluxo-caixa";
import { caixaPorConta, periodoMes } from "@/lib/conciliacao-saldo";

export const dynamic = "force-dynamic";

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function deslocarMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Fluxo de caixa: realizado do mês (extrato), previsto até o fim do mês e próximos meses. */
export default async function FluxoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  await requirePermissao("financeiro_fluxo");
  const supabase = await createClient();

  const hoje = hojeYmdLocal();
  const mesAtual = hoje.slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : mesAtual;
  const { inicio, fim, label } = periodoMes(mes);
  const ehMesAtual = mes === mesAtual;
  const ehFuturo = mes > mesAtual;
  const ateRealizado = ehMesAtual ? hoje : fim;

  // ---------------- Realizado no mês (livro de pagamentos) ----------------
  type PagRow = {
    id: string;
    valor: number;
    taxa: number;
    data_pagamento: string;
    lancamento_id: string | null;
    contas_financeiras: { nome: string } | null;
    lancamentos_financeiros: { tipo: "receita" | "despesa"; descricao: string; categorias_financeiras: { nome: string } | null } | null;
  };
  const movimentos: MovimentoCaixa[] = [];
  if (!ehFuturo) {
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase
        .from("os_pagamentos")
        .select("id, valor, taxa, data_pagamento, lancamento_id, contas_financeiras(nome), lancamentos_financeiros!inner(tipo, descricao, categorias_financeiras(nome))")
        .gte("data_pagamento", inicio)
        .lte("data_pagamento", ateRealizado)
        .order("id")
        .range(de, de + 999);
      if (error) throw new Error(error.message);
      for (const r of (data || []) as unknown as PagRow[]) {
        if (!r.lancamentos_financeiros) continue;
        movimentos.push({
          id: r.id,
          data: r.data_pagamento,
          tipo: r.lancamentos_financeiros.tipo,
          valor: Number(r.valor),
          taxa: Number(r.taxa || 0),
          descricao: r.lancamentos_financeiros.descricao,
          categoria: r.lancamentos_financeiros.categorias_financeiras?.nome ?? null,
          conta: r.contas_financeiras?.nome ?? null,
          lancamentoId: r.lancamento_id,
        });
      }
      if (!data || data.length < 1000) break;
    }
  }

  // ---------------- Saldo real (só com saldo das contas informado) ----------------
  // O saldo no fim do período vem das contas (já considera a data do saldo informado);
  // o saldo de início do mês é calculado de trás para frente: fim − resultado do mês.
  const caixaFim = await caixaPorConta(supabase, ehFuturo ? hoje : ateRealizado);
  const dataSaldo = caixaFim.dataSaldoInformado;
  // Saldos todos zerados = provavelmente não preenchidos: não inventa saldo
  const saldoRealConhecido =
    caixaFim.configurado && !caixaFim.saldosZerados && dataSaldo != null && (ehFuturo || ateRealizado >= dataSaldo);
  const resultadoRealizado = extratoMes(movimentos, null).resultado;
  const saldoInicioMes = saldoRealConhecido && !ehFuturo ? Math.round((caixaFim.total - resultadoRealizado) * 100) / 100 : null;
  const extrato = extratoMes(movimentos, saldoInicioMes);

  // ---------------- Previsto (títulos em aberto) ----------------
  const titulos: TituloAberto[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("lancamentos_financeiros")
      .select("id, tipo, descricao, valor, valor_pago, juros, multa, data_vencimento")
      .in("status", ["pendente", "parcial"])
      .order("id")
      .range(de, de + 999);
    if (error) throw new Error(error.message);
    titulos.push(...((data || []) as TituloAberto[]));
    if (!data || data.length < 1000) break;
  }
  // Antes do início do controle financeiro é histórico: não entra em previsão nem em vencidos
  const { financeiro_inicio: corte } = await getConfig();
  if (corte) {
    for (let i = titulos.length - 1; i >= 0; i--) {
      const v = titulos[i].data_vencimento;
      if (v && v < corte) titulos.splice(i, 1);
    }
  }

  // Despesas fixas ainda não geradas (aluguel etc.) entram na previsão
  const [{ data: recorrentes }, { data: jaGeradas }] = await Promise.all([
    supabase.from("despesas_recorrentes").select("id, descricao, valor, dia_vencimento").eq("ativo", true),
    supabase
      .from("lancamentos_financeiros")
      .select("recorrencia_id, data_competencia")
      .not("recorrencia_id", "is", null)
      .neq("status", "cancelado")
      .gte("data_competencia", `${mesAtual}-01`),
  ]);
  const gerada = new Set((jaGeradas || []).map((g) => `${g.recorrencia_id}|${String(g.data_competencia).slice(0, 7)}`));
  for (let i = 0; i < 7; i++) {
    const mk = deslocarMes(mesAtual, i);
    const { fim: fimMk } = periodoMes(mk);
    const ultimoDia = Number(fimMk.slice(8));
    for (const r of recorrentes || []) {
      if (gerada.has(`${r.id}|${mk}`)) continue;
      const venc = `${mk}-${String(Math.min(r.dia_vencimento, ultimoDia)).padStart(2, "0")}`;
      if (venc < hoje) continue;
      titulos.push({ id: `rec:${r.id}:${mk}`, tipo: "despesa", descricao: `${r.descricao} (despesa fixa)`, valor: Number(r.valor), valor_pago: 0, juros: 0, multa: 0, data_vencimento: venc });
    }
  }

  const aVencer = titulos
    .map((t) => ({ ...t, saldo: saldoEmAberto(t) }))
    .filter((t) => t.saldo > 0 && t.data_vencimento && t.data_vencimento >= (ehMesAtual ? hoje : inicio) && t.data_vencimento <= fim)
    .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));
  const receberMes = aVencer.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.saldo, 0);
  const pagarMes = aVencer.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.saldo, 0);
  const resultadoPrevistoMes = extrato.resultado + receberMes - pagarMes;

  // Próximos meses (a partir do mês seguinte ao visualizado)
  const periodos = Array.from({ length: 6 }).map((_, i) => {
    const mk = deslocarMes(mes, i + 1);
    return { key: mk, label: `${MESES_CURTOS[Number(mk.slice(5)) - 1]}/${mk.slice(2, 4)}` };
  });
  const saldoFimMes = saldoRealConhecido
    ? (ehFuturo ? caixaFim.total : extrato.saldoFinal) + receberMes - pagarMes
    : 0;
  const { linhas: proximos, atraso } = projetarFluxo({
    titulos,
    periodos,
    hoje,
    caixaAtual: saldoFimMes,
    chaveDe: (v) => v.slice(0, 7),
  });

  const ultimosDias = extrato.dias;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/financeiro" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Financeiro
      </Link>
      <PageHeader title="Fluxo de caixa" subtitle="Dinheiro que entrou e saiu de verdade, e o que ainda está previsto" />

      {/* Navegação de mês */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`/financeiro/fluxo?mes=${deslocarMes(mes, -1)}`} className="btn-secondary px-2" aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <p className="text-lg font-semibold capitalize text-slate-900">{label}</p>
          {ehMesAtual && <p className="text-xs text-slate-500">até hoje, {formatDate(hoje)}</p>}
          {!ehMesAtual && (
            <Link href="/financeiro/fluxo" className="text-xs text-brand-700 hover:underline">
              voltar para o mês atual
            </Link>
          )}
        </div>
        <Link href={`/financeiro/fluxo?mes=${deslocarMes(mes, 1)}`} className="btn-secondary px-2" aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {caixaFim.configurado && caixaFim.saldosZerados && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-2">
            <Landmark className="h-4 w-4 shrink-0" />
            Os saldos das contas foram informados como R$ 0,00 em {formatDate(dataSaldo)}. Se não era o valor real do extrato, corrija para o
            saldo ficar certo.
          </p>
          <Link href="/financeiro/contas" className="btn-secondary py-1 text-xs">
            Corrigir saldos
          </Link>
        </div>
      )}

      {!saldoRealConhecido && !caixaFim.saldosZerados && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-2">
            <Landmark className="h-4 w-4 shrink-0" />
            {dataSaldo
              ? <>Este mês é anterior ao saldo informado ({formatDate(dataSaldo)}): aparece só o que entrou e saiu.</>
              : <>Para ver o <strong>saldo real</strong> das contas, informe o saldo do extrato do Bradesco, InfinitePay e Caixa numa data. Até lá, o fluxo mostra só o que entrou e saiu.</>}
          </p>
          <Link href="/financeiro/contas" className="btn-secondary py-1 text-xs">
            Informar saldos
          </Link>
        </div>
      )}

      {/* Resumo do mês */}
      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
          <Bloco
            rotulo="Saldo no início do mês"
            valor={saldoInicioMes}
            vazio="—"
            ajuda={saldoInicioMes != null ? (dataSaldo && dataSaldo >= inicio ? `calculado a partir do saldo de ${formatDate(dataSaldo)}` : undefined) : dataSaldo ? `saldo informado só a partir de ${formatDate(dataSaldo)}` : "informe os saldos"}
          />
          <Bloco rotulo="Entradas" valor={extrato.entradas} cor="text-green-700" ajuda={extrato.taxas > 0 ? `líquido de ${formatCurrency(extrato.taxas)} em taxas` : "recebido no mês"} />
          <Bloco rotulo="Saídas" valor={extrato.saidas} cor="text-red-700" ajuda="pago no mês" />
          <Bloco
            rotulo={!saldoRealConhecido ? "Resultado do mês" : ehMesAtual ? "Saldo hoje" : "Saldo no fim do mês"}
            valor={saldoRealConhecido ? extrato.saldoFinal : extrato.resultado}
            cor={(saldoRealConhecido ? extrato.saldoFinal : extrato.resultado) >= 0 ? "text-slate-900" : "text-red-700"}
            ajuda={saldoRealConhecido ? caixaFim.contas.map((c) => `${c.nome.split(" ")[0]} ${formatCurrency(c.saldo)}`).join(" • ") : "entradas − saídas"}
            forte
          />
        </div>
        {(ehMesAtual || ehFuturo) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="text-slate-600">
              Até {formatDate(fim)}: a receber <strong className="text-green-700">{formatCurrency(receberMes)}</strong> • a pagar{" "}
              <strong className="text-red-700">{formatCurrency(pagarMes)}</strong>
            </span>
            <span className="font-semibold text-slate-800">
              Resultado previsto do mês: <span className={resultadoPrevistoMes >= 0 ? "text-green-700" : "text-red-700"}>{formatCurrency(resultadoPrevistoMes)}</span>
            </span>
          </div>
        )}
      </div>

      {atraso.qtdReceber + atraso.qtdPagar > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-slate-700">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Vencidos e não registrados (fora do fluxo): receber {formatCurrency(atraso.receber)} ({atraso.qtdReceber}) • pagar{" "}
            {formatCurrency(atraso.pagar)} ({atraso.qtdPagar})
          </span>
          <Link href="/financeiro/pendencias" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
            <ListChecks className="h-4 w-4" /> Resolver
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Extrato do mês */}
        <div className="card p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold text-slate-900">Movimentação do mês</h2>
            <span className="text-xs text-slate-500">{movimentos.length} lançamento(s)</span>
          </div>
          {ultimosDias.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              {ehFuturo ? "Mês futuro — veja o previsto ao lado." : "Nenhuma entrada ou saída registrada neste mês."}
            </p>
          ) : (
            <ul>
              {ultimosDias.map((d) => (
                <li key={d.data} className="border-b border-slate-100 last:border-0">
                  <div className="flex items-center justify-between bg-slate-50/70 px-4 py-1.5 text-xs text-slate-500">
                    <span className="font-medium capitalize">
                      {new Date(`${d.data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </span>
                    <span>
                      {saldoRealConhecido ? "saldo" : "acumulado no mês"} <strong className="text-slate-700">{formatCurrency(d.saldo)}</strong>
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-50">
                    {d.movimentos.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.liquido >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                          {m.liquido >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          {m.lancamentoId ? (
                            <Link href={`/financeiro/lancamentos/${m.lancamentoId}`} className="block truncate text-slate-800 hover:underline">
                              {m.descricao}
                            </Link>
                          ) : (
                            <span className="block truncate text-slate-800">{m.descricao}</span>
                          )}
                          <span className="block truncate text-xs text-slate-400">
                            {[m.categoria, m.conta ?? "sem conta", m.taxa > 0 ? `taxa ${formatCurrency(m.taxa)}` : null].filter(Boolean).join(" • ")}
                          </span>
                        </span>
                        <span className={`shrink-0 font-semibold ${m.liquido >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {m.liquido >= 0 ? "+" : "−"} {formatCurrency(Math.abs(m.liquido))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {/* A vencer no mês */}
          {(ehMesAtual || ehFuturo) && (
            <div className="card p-0">
              <h2 className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">Previsto até o fim do mês</h2>
              {aVencer.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">Nada a vencer.</p>
              ) : (
                <ul className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
                  {aVencer.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                      <span className="min-w-0">
                        {t.id.startsWith("rec:") ? (
                          <span className="block truncate text-slate-800">{t.descricao}</span>
                        ) : (
                          <Link href={`/financeiro/lancamentos/${t.id}`} className="block truncate text-slate-800 hover:underline">
                            {t.descricao}
                          </Link>
                        )}
                        <span className="text-xs text-slate-400">vence {formatDate(t.data_vencimento)}</span>
                      </span>
                      <span className={`shrink-0 font-medium ${t.tipo === "receita" ? "text-green-700" : "text-red-700"}`}>
                        {t.tipo === "receita" ? "+" : "−"} {formatCurrency(t.saldo)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Próximos meses */}
          <div className="card p-0">
            <h2 className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">Próximos meses</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">Mês</th>
                  <th className="px-2 py-2 text-right font-medium">Entradas</th>
                  <th className="px-2 py-2 text-right font-medium">Saídas</th>
                  <th className="px-4 py-2 text-right font-medium">{saldoRealConhecido ? "Saldo" : "Resultado"}</th>
                </tr>
              </thead>
              <tbody>
                {proximos.map((l) => (
                  <tr key={l.key} className="border-t border-slate-50">
                    <td className="px-4 py-2">
                      <Link href={`/financeiro/fluxo?mes=${l.key}`} className="hover:underline">
                        {l.label}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right text-green-700">{formatCurrency(l.entradas)}</td>
                    <td className="px-2 py-2 text-right text-red-700">{formatCurrency(l.saidas)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${(saldoRealConhecido ? l.saldo : l.resultado) >= 0 ? "text-slate-900" : "text-red-700"}`}>
                      {formatCurrency(saldoRealConhecido ? l.saldo : l.resultado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
              Baseado nos títulos em aberto com vencimento e nas despesas fixas. Vendas futuras ainda não lançadas não aparecem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bloco({
  rotulo,
  valor,
  cor = "text-slate-900",
  ajuda,
  vazio,
  forte,
}: {
  rotulo: string;
  valor: number | null;
  cor?: string;
  ajuda?: string;
  vazio?: string;
  forte?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{rotulo}</p>
      <p className={`mt-1 ${forte ? "text-2xl" : "text-xl"} font-bold tracking-tight ${valor == null ? "text-slate-300" : cor}`}>
        {valor == null ? vazio : formatCurrency(valor)}
      </p>
      {ajuda && <p className="mt-0.5 text-[11px] text-slate-400">{ajuda}</p>}
    </div>
  );
}
