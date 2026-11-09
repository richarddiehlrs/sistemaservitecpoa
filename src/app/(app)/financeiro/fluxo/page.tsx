import Link from "next/link";
import { AlertTriangle, ArrowLeft, Wallet, TrendingUp, TrendingDown, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader, StatCard } from "@/components/ui";
import { MonthlyBars } from "@/components/charts";
import { formatCurrency, formatDate, hojeYmdLocal } from "@/lib/format";
import { inicioSemanaISO, labelSemana } from "@/lib/financeiro";
import { projetarFluxo, type Periodo, type TituloAberto } from "@/lib/fluxo-caixa";
import { caixaPorConta } from "@/lib/conciliacao-saldo";

export const dynamic = "force-dynamic";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function FluxoPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; atrasados?: string }>;
}) {
  const { visao, atrasados } = await searchParams;
  await requirePermissao("financeiro_fluxo");
  const modoSemana = visao === "semana";
  const incluirAtrasados = atrasados === "1";

  const supabase = await createClient();
  const hojeISO = hojeYmdLocal();
  const [ano, mes, dia] = hojeISO.split("-").map(Number);
  const hoje = new Date(ano, mes - 1, dia);

  // Títulos em aberto (paginado: o Supabase devolve no máximo 1000 por consulta)
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

  // Despesas fixas dos próximos meses que ainda não foram geradas também entram na projeção
  const ultimoMesProj = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 0);
  const [{ data: recorrentes }, { data: jaGeradas }] = await Promise.all([
    supabase.from("despesas_recorrentes").select("id, descricao, valor, dia_vencimento").eq("ativo", true),
    supabase
      .from("lancamentos_financeiros")
      .select("recorrencia_id, data_competencia")
      .not("recorrencia_id", "is", null)
      .neq("status", "cancelado")
      .gte("data_competencia", `${hojeISO.slice(0, 7)}-01`),
  ]);
  const gerada = new Set((jaGeradas || []).map((g) => `${g.recorrencia_id}|${String(g.data_competencia).slice(0, 7)}`));
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    if (d > ultimoMesProj) break;
    const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (const r of recorrentes || []) {
      if (gerada.has(`${r.id}|${mesKey}`)) continue;
      const venc = `${mesKey}-${String(Math.min(r.dia_vencimento, ultimoDia)).padStart(2, "0")}`;
      if (venc < hojeISO) continue; // mês atual já passado e não gerado: não inventa atraso
      titulos.push({
        id: `rec:${r.id}:${mesKey}`,
        tipo: "despesa",
        descricao: `${r.descricao} (fixa, prevista)`,
        valor: Number(r.valor),
        valor_pago: 0,
        juros: 0,
        multa: 0,
        data_vencimento: venc,
      });
    }
  }

  const caixa = await caixaPorConta(supabase, hojeISO);
  const contasSemSaldo = caixa.contas.filter((c) => !c.configurada);

  let periodos: Periodo[];
  let chaveDe: (venc: string) => string;
  if (modoSemana) {
    periodos = Array.from({ length: 8 }).map((_, i) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i * 7);
      const key = inicioSemanaISO(d);
      return { key, label: `Sem ${labelSemana(key)}` };
    });
    chaveDe = (venc) => inicioSemanaISO(new Date(venc + "T00:00:00"));
  } else {
    periodos = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` };
    });
    chaveDe = (venc) => venc.slice(0, 7);
  }

  const { linhas, atraso, semVencimento } = projetarFluxo({
    titulos,
    periodos,
    hoje: hojeISO,
    caixaAtual: caixa.total,
    chaveDe,
    incluirAtrasados,
  });

  const chartData = linhas.map((l) => ({ label: l.label, receita: l.entradas, despesa: l.saidas }));
  const saldoFinal = linhas.length ? linhas[linhas.length - 1].saldo : caixa.total;
  const totalEntradas = linhas.reduce((s, l) => s + l.entradas, 0);
  const totalSaidas = linhas.reduce((s, l) => s + l.saidas, 0);
  const qs = (extra: Record<string, string>) =>
    `/financeiro/fluxo?${new URLSearchParams({ visao: modoSemana ? "semana" : "mes", ...(incluirAtrasados ? { atrasados: "1" } : {}), ...extra })}`;

  return (
    <div>
      <PageHeader
        title="Fluxo de caixa projetado"
        subtitle={
          (modoSemana ? "Próximas 8 semanas" : "Próximos 6 meses") +
          (incluirAtrasados ? " — incluindo títulos atrasados" : " — só o que vence de hoje em diante")
        }
        action={
          <Link href="/financeiro" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={qs({ visao: "mes" })} className={`badge ${!modoSemana ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
          Mensal
        </Link>
        <Link href={qs({ visao: "semana" })} className={`badge ${modoSemana ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
          Semanal
        </Link>
        <Link
          href={incluirAtrasados ? `/financeiro/fluxo?visao=${modoSemana ? "semana" : "mes"}` : qs({ atrasados: "1" })}
          className={`badge ${incluirAtrasados ? "bg-amber-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          title="Soma os títulos vencidos no primeiro período"
        >
          {incluirAtrasados ? "✓ " : ""}Incluir atrasados na projeção
        </Link>
      </div>

      {(contasSemSaldo.length > 0 || caixa.semConta !== 0) && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> O caixa atual ainda não reflete o saldo real
          </p>
          {contasSemSaldo.length > 0 && (
            <p className="mt-1">
              Informe o saldo inicial de {contasSemSaldo.map((c) => c.nome).join(", ")} em{" "}
              <Link href="/financeiro/contas" className="font-medium underline">Contas</Link>.
            </p>
          )}
          {caixa.semConta !== 0 && (
            <p className="mt-1">
              {formatCurrency(caixa.semConta)} em pagamentos sem conta definida (sem forma de pagamento) — edite-os para escolher a conta.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Caixa atual"
          value={formatCurrency(caixa.total)}
          hint={caixa.contas.map((c) => `${c.nome}: ${formatCurrency(c.saldo)}`).join(" • ")}
          tone={caixa.total >= 0 ? "blue" : "red"}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard title="Entradas previstas" value={formatCurrency(totalEntradas)} tone="green" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Saídas previstas" value={formatCurrency(totalSaidas)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard
          title={`Saldo projetado (${modoSemana ? "8 sem" : "6 meses"})`}
          value={formatCurrency(saldoFinal)}
          tone={saldoFinal >= 0 ? "green" : "red"}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      {(atraso.qtdReceber > 0 || atraso.qtdPagar > 0) && (
        <div className="mt-4 card border-amber-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Títulos vencidos (fora da projeção)</h2>
              <p className="text-sm text-slate-500">
                A receber: <strong className="text-green-700">{formatCurrency(atraso.receber)}</strong> ({atraso.qtdReceber}) • A pagar:{" "}
                <strong className="text-red-700">{formatCurrency(atraso.pagar)}</strong> ({atraso.qtdPagar}). Se já foram pagos, dê baixa — se não
                serão cobrados, encerre.
              </p>
            </div>
            <Link href="/financeiro/pendencias" className="btn-primary">
              <ListChecks className="h-4 w-4" /> Resolver pendências
            </Link>
          </div>
          <ul className="mt-3 max-h-60 divide-y divide-slate-100 overflow-auto text-sm">
            {atraso.itens.slice(0, 50).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                <Link href={`/financeiro/lancamentos/${t.id}`} className="min-w-0 truncate hover:underline">
                  {t.descricao}
                </Link>
                <span className="shrink-0 text-xs text-slate-500">
                  venceu {formatDate(t.data_vencimento)} ({t.diasAtraso} dias)
                </span>
                <strong className={`shrink-0 ${t.tipo === "receita" ? "text-green-700" : "text-red-700"}`}>
                  {t.tipo === "receita" ? "+" : "-"} {formatCurrency(t.saldo)}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 card p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Entradas x Saídas previstas</h2>
        <MonthlyBars data={chartData} />
      </div>

      <div className="mt-6 card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>{modoSemana ? "Semana" : "Mês"}</th>
              <th className="text-right">Entradas</th>
              <th className="text-right">Saídas</th>
              <th className="text-right">Resultado</th>
              <th className="text-right">Saldo projetado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.key}>
                <td className="font-medium">{l.label}</td>
                <td className="text-right text-green-600">{formatCurrency(l.entradas)}</td>
                <td className="text-right text-red-600">{formatCurrency(l.saidas)}</td>
                <td className={`text-right font-medium ${l.resultado >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(l.resultado)}
                </td>
                <td className={`text-right font-bold ${l.saldo >= 0 ? "text-slate-900" : "text-red-600"}`}>
                  {formatCurrency(l.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {semVencimento > 0 && (
          <p className="px-4 py-2 text-xs text-slate-500">{semVencimento} título(s) em aberto sem data de vencimento não entram na projeção.</p>
        )}
      </div>
    </div>
  );
}
