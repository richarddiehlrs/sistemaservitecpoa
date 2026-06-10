import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type Grupo = string;

function periodo(ano: number, mes?: number) {
  if (mes && mes >= 1 && mes <= 12) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0);
    return {
      inicio: inicio.toISOString().slice(0, 10),
      fim: fim.toISOString().slice(0, 10),
      label: inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    };
  }
  return {
    inicio: `${ano}-01-01`,
    fim: `${ano}-12-31`,
    label: `Ano ${ano}`,
  };
}

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  await requirePermissao("dre");
  const ano = Number(sp.ano) || new Date().getFullYear();
  const mes = sp.mes ? Number(sp.mes) : undefined;
  const p = periodo(ano, mes);

  const supabase = await createClient();
  const { data } = await supabase
    .from("lancamentos_financeiros")
    .select("valor, tipo, status, categorias_financeiras(grupo_dre)")
    .neq("status", "cancelado")
    .gte("data_competencia", p.inicio)
    .lte("data_competencia", p.fim);

  const soma: Record<Grupo, number> = {};
  for (const l of data || []) {
    // @ts-expect-error relação
    const g = l.categorias_financeiras?.grupo_dre || (l.tipo === "receita" ? "outras_receitas" : "despesa_operacional");
    soma[g] = (soma[g] || 0) + Number(l.valor);
  }
  const g = (k: string) => soma[k] || 0;

  const receitaServico = g("receita_servico");
  const receitaPecas = g("receita_pecas");
  const outrasReceitas = g("outras_receitas");
  const receitaBruta = receitaServico + receitaPecas + outrasReceitas;

  const impostos = g("impostos");
  const receitaLiquida = receitaBruta - impostos;

  const custos = g("custo_pecas") + g("custo_servico");
  const lucroBruto = receitaLiquida - custos;

  const despOperacional = g("despesa_operacional");
  const despAdmin = g("despesa_administrativa");
  const despFinanceira = g("despesa_financeira");
  const totalDespesas = despOperacional + despAdmin + despFinanceira;

  const resultado = lucroBruto - totalDespesas;
  const margem = receitaBruta > 0 ? (resultado / receitaBruta) * 100 : 0;

  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];

  return (
    <div>
      <PageHeader
        title="DRE — Demonstração do Resultado"
        subtitle={`Regime de competência • ${p.label}`}
      />

      <form className="mb-6 flex flex-wrap items-center gap-2" action="/dre" method="get">
        <select name="ano" defaultValue={String(ano)} className="input max-w-[140px]">
          {[0, 1, 2, 3].map((d) => {
            const y = new Date().getFullYear() - d;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        <select name="mes" defaultValue={mes ? String(mes) : ""} className="input max-w-[180px]">
          <option value="">Ano inteiro</option>
          {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <button className="btn-secondary">Gerar</button>
      </form>

      <div className="card mx-auto max-w-2xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            <Linha titulo="Receita com serviços" valor={receitaServico} />
            <Linha titulo="Receita com peças" valor={receitaPecas} />
            <Linha titulo="Outras receitas" valor={outrasReceitas} />
            <LinhaTotal titulo="(=) RECEITA BRUTA" valor={receitaBruta} />

            <Linha titulo="(-) Impostos sobre vendas" valor={-impostos} negativo />
            <LinhaTotal titulo="(=) RECEITA LÍQUIDA" valor={receitaLiquida} />

            <Linha titulo="(-) Custos (peças e serviços)" valor={-custos} negativo />
            <LinhaTotal titulo="(=) LUCRO BRUTO" valor={lucroBruto} />

            <Linha titulo="(-) Despesas operacionais" valor={-despOperacional} negativo />
            <Linha titulo="(-) Despesas administrativas" valor={-despAdmin} negativo />
            <Linha titulo="(-) Despesas financeiras" valor={-despFinanceira} negativo />
            <LinhaTotal titulo="(-) TOTAL DE DESPESAS" valor={-totalDespesas} negativo />

            <tr className={resultado >= 0 ? "bg-green-50" : "bg-red-50"}>
              <td className="px-5 py-4 text-base font-bold text-slate-900">
                (=) RESULTADO LÍQUIDO
              </td>
              <td className={`px-5 py-4 text-right text-lg font-bold ${resultado >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(resultado)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
        Margem líquida:{" "}
        <span className={margem >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
          {margem.toFixed(1)}%
        </span>
      </p>
    </div>
  );
}

function Linha({ titulo, valor, negativo }: { titulo: string; valor: number; negativo?: boolean }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-5 py-2.5 text-slate-600">{titulo}</td>
      <td className={`px-5 py-2.5 text-right ${negativo ? "text-red-600" : "text-slate-800"}`}>
        {formatCurrency(valor)}
      </td>
    </tr>
  );
}

function LinhaTotal({ titulo, valor, negativo }: { titulo: string; valor: number; negativo?: boolean }) {
  return (
    <tr className="border-b border-slate-200 bg-slate-50">
      <td className="px-5 py-3 font-semibold text-slate-800">{titulo}</td>
      <td className={`px-5 py-3 text-right font-semibold ${negativo ? "text-red-700" : "text-slate-900"}`}>
        {formatCurrency(valor)}
      </td>
    </tr>
  );
}
