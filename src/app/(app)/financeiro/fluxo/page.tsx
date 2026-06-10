import Link from "next/link";
import { ArrowLeft, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader, StatCard } from "@/components/ui";
import { MonthlyBars } from "@/components/charts";
import { formatCurrency } from "@/lib/format";
import { saldoEmAberto, inicioSemanaISO, labelSemana } from "@/lib/financeiro";

export const dynamic = "force-dynamic";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type LancPend = {
  tipo: string;
  valor: number;
  valor_pago: number;
  juros: number;
  multa: number;
  data_vencimento: string | null;
};

export default async function FluxoPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string }>;
}) {
  const { visao } = await searchParams;
  await requirePermissao("financeiro_fluxo");
  const modoSemana = visao === "semana";

  const supabase = await createClient();
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const semanaAtual = inicioSemanaISO(hoje);

  const [{ data: realizados }, { data: pendentes }] = await Promise.all([
    supabase
      .from("lancamentos_financeiros")
      .select("tipo, valor_pago")
      .neq("status", "cancelado"),
    supabase
      .from("lancamentos_financeiros")
      .select("tipo, valor, valor_pago, juros, multa, data_vencimento")
      .in("status", ["pendente", "parcial"])
      .not("data_vencimento", "is", null),
  ]);

  const caixaAtual = (realizados || []).reduce(
    (s, l) => s + (l.tipo === "receita" ? Number(l.valor_pago) : -Number(l.valor_pago)),
    0
  );

  type Periodo = { key: string; label: string };
  let periodos: Periodo[] = [];

  if (modoSemana) {
    periodos = Array.from({ length: 8 }).map((_, i) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i * 7);
      const key = inicioSemanaISO(d);
      return { key, label: `Sem ${labelSemana(key)}` };
    });
  } else {
    periodos = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` };
    });
  }

  const bucket: Record<string, { entradas: number; saidas: number }> = {};
  periodos.forEach((p) => (bucket[p.key] = { entradas: 0, saidas: 0 }));

  for (const l of (pendentes || []) as LancPend[]) {
    const venc = l.data_vencimento || "";
    const saldo = saldoEmAberto(l);

    let key: string;
    if (modoSemana) {
      const vencDate = venc < hojeISO ? hoje : new Date(venc + "T00:00:00");
      key = inicioSemanaISO(vencDate);
      if (key < semanaAtual) key = semanaAtual;
    } else {
      const mesVenc = venc.slice(0, 7);
      key = mesVenc < mesAtual ? mesAtual : mesVenc;
    }

    if (!bucket[key]) continue;
    if (l.tipo === "receita") bucket[key].entradas += saldo;
    else bucket[key].saidas += saldo;
  }

  let acumulado = caixaAtual;
  const linhas = periodos.map((p) => {
    const b = bucket[p.key];
    const resultado = b.entradas - b.saidas;
    acumulado += resultado;
    return { ...p, entradas: b.entradas, saidas: b.saidas, resultado, saldo: acumulado };
  });

  const chartData = linhas.map((l) => ({ label: l.label, receita: l.entradas, despesa: l.saidas }));
  const saldoFinal = linhas.length ? linhas[linhas.length - 1].saldo : caixaAtual;
  const totalEntradas = linhas.reduce((s, l) => s + l.entradas, 0);
  const totalSaidas = linhas.reduce((s, l) => s + l.saidas, 0);

  return (
    <div>
      <PageHeader
        title="Fluxo de caixa projetado"
        subtitle={modoSemana ? "Projeção semanal — próximas 8 semanas" : "Projeção mensal — próximos 6 meses"}
        action={
          <Link href="/financeiro" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        }
      />

      <div className="mb-4 flex gap-2">
        <Link href="/financeiro/fluxo?visao=mes" className={`badge ${!modoSemana ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
          Mensal
        </Link>
        <Link href="/financeiro/fluxo?visao=semana" className={`badge ${modoSemana ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
          Semanal
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Caixa atual" value={formatCurrency(caixaAtual)} tone={caixaAtual >= 0 ? "blue" : "red"} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Entradas previstas" value={formatCurrency(totalEntradas)} tone="green" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Saídas previstas" value={formatCurrency(totalSaidas)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title={`Saldo projetado (${modoSemana ? "8 sem" : "6 mes"})`} value={formatCurrency(saldoFinal)} tone={saldoFinal >= 0 ? "green" : "red"} icon={<Wallet className="h-5 w-5" />} />
      </div>

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
      </div>
    </div>
  );
}

