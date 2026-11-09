import Link from "next/link";
import { Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader } from "@/components/ui";
import { ExportCsv } from "@/components/export-csv";
import { formatCurrency, hojeYmdLocal } from "@/lib/format";
import { calcularDre, receitaARealizar, type GrupoDre, type LinhaCategoria } from "@/lib/resultado";
import { carregarBaseResultado } from "@/lib/resultado-dados";

export const dynamic = "force-dynamic";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function periodo(ano: number, mes?: number) {
  if (mes && mes >= 1 && mes <= 12) {
    const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const mm = String(mes).padStart(2, "0");
    return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimo).padStart(2, "0")}`, label: `${MESES[mes - 1]} de ${ano}` };
  }
  return { inicio: `${ano}-01-01`, fim: `${ano}-12-31`, label: `Ano ${ano}` };
}

export default async function DrePage({ searchParams }: { searchParams: Promise<{ ano?: string; mes?: string }> }) {
  const sp = await searchParams;
  await requirePermissao("dre");
  const hoje = hojeYmdLocal();
  const anoAtual = Number(hoje.slice(0, 4));
  const ano = Number(sp.ano) || anoAtual;
  const mes = sp.mes === "" ? undefined : sp.mes ? Number(sp.mes) : Number(hoje.slice(5, 7));
  const p = periodo(ano, mes);

  const supabase = await createClient();
  const base = await carregarBaseResultado(supabase, p.inicio, p.fim);
  const dre = calcularDre(base.lancamentos, base.os, base.taxas, p.inicio, p.fim);
  const aRealizar = receitaARealizar(base.lancamentos, base.os);

  const cats = (grupos: GrupoDre[]) => dre.porCategoria.filter((c) => grupos.includes(c.grupo));
  const pct = (v: number) => (dre.receitaBruta > 0 ? `${((v / dre.receitaBruta) * 100).toFixed(1).replace(".", ",")}%` : "—");

  const csv: (string | number)[][] = [
    ["Receita bruta", dre.receitaBruta],
    ["Impostos", -dre.impostos],
    ["Receita líquida", dre.receitaLiquida],
    ["Custo de peças", -dre.custoPecas],
    ["Custo de serviços terceirizados", -dre.custoServico],
    ["Lucro bruto", dre.lucroBruto],
    ["Despesas operacionais", -dre.despesaOperacional],
    ["Despesas administrativas", -dre.despesaAdministrativa],
    ["Despesas financeiras", -dre.despesaFinanceira],
    ["Resultado líquido", dre.lucroLiquido],
    ...dre.porCategoria.map((c) => [`  ${c.categoria}`, c.valor]),
  ].map(([a, b]) => [a, Number(b).toFixed(2).replace(".", ",")]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="DRE — Demonstração do Resultado"
        subtitle={`Regime de competência • ${p.label}`}
        action={<ExportCsv filename={`dre-${p.inicio.slice(0, 7)}${mes ? "" : "-ano"}.csv`} headers={["Conta", "Valor (R$)"]} rows={csv} />}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/dre" method="get">
        <select name="ano" defaultValue={String(ano)} className="input max-w-[120px]">
          {[0, 1, 2, 3].map((d) => (
            <option key={d} value={anoAtual - d}>
              {anoAtual - d}
            </option>
          ))}
        </select>
        <select name="mes" defaultValue={mes ? String(mes) : ""} className="input max-w-[170px]">
          <option value="">Ano inteiro</option>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Gerar</button>
        <Link href={`/resultados?mes=${p.inicio.slice(0, 7)}`} className="ml-auto text-sm text-brand-700 hover:underline">
          Ver painel de resultados →
        </Link>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <th className="px-5 py-2 text-left font-medium">Conta</th>
              <th className="px-5 py-2 text-right font-medium">Valor</th>
              <th className="w-20 px-5 py-2 text-right font-medium">% receita</th>
            </tr>
          </thead>
          <tbody>
            <Grupo titulo="Receita de serviços" valor={dre.receitaServico} itens={cats(["receita_servico"])} pct={pct} />
            <Grupo titulo="Receita de peças" valor={dre.receitaPecas} itens={cats(["receita_pecas"])} pct={pct} />
            <Grupo titulo="Outras receitas" valor={dre.outrasReceitas} itens={cats(["outras_receitas"])} pct={pct} />
            <Total titulo="(=) RECEITA BRUTA" valor={dre.receitaBruta} pct={pct} />

            <Grupo titulo="(−) Impostos sobre o faturamento" valor={-dre.impostos} itens={cats(["impostos"])} pct={pct} negativo />
            <Total titulo="(=) RECEITA LÍQUIDA" valor={dre.receitaLiquida} pct={pct} />

            <Grupo titulo="(−) Custo de peças" valor={-dre.custoPecas} itens={cats(["custo_pecas"])} pct={pct} negativo />
            <Grupo titulo="(−) Serviços terceirizados" valor={-dre.custoServico} itens={cats(["custo_servico"])} pct={pct} negativo />
            <Total titulo="(=) LUCRO BRUTO" valor={dre.lucroBruto} pct={pct} />

            <Grupo titulo="(−) Despesas operacionais" valor={-dre.despesaOperacional} itens={cats(["despesa_operacional"])} pct={pct} negativo />
            <Grupo titulo="(−) Despesas administrativas" valor={-dre.despesaAdministrativa} itens={cats(["despesa_administrativa"])} pct={pct} negativo />
            <Grupo titulo="(−) Despesas financeiras" valor={-dre.despesaFinanceira} itens={cats(["despesa_financeira"])} pct={pct} negativo />
            <Total titulo="(−) TOTAL DE DESPESAS" valor={-dre.despesas} pct={pct} negativo />

            <tr className={dre.lucroLiquido >= 0 ? "bg-green-50" : "bg-red-50"}>
              <td className="px-5 py-4 text-base font-bold text-slate-900">(=) RESULTADO LÍQUIDO</td>
              <td className={`px-5 py-4 text-right text-lg font-bold ${dre.lucroLiquido >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(dre.lucroLiquido)}
              </td>
              <td className="px-5 py-4 text-right font-semibold text-slate-600">{pct(dre.lucroLiquido)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Mini rotulo="OS concluídas" valor={String(dre.osConcluidas)} />
        <Mini rotulo="Ticket médio" valor={formatCurrency(dre.ticketMedio)} />
        <Mini rotulo="Serviços aprovados a concluir" valor={formatCurrency(aRealizar.valor)} ajuda={`${aRealizar.qtd} OS — entram quando concluídas`} />
      </div>

      <details className="card mt-4 p-4 text-sm text-slate-600">
        <summary className="flex cursor-pointer items-center gap-2 font-medium text-slate-800">
          <Info className="h-4 w-4" /> Como a DRE é calculada
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Receita e custo de peças de cada OS entram no mês em que o serviço foi <strong>concluído</strong>.</li>
          <li>OS aprovada e ainda não concluída não entra (aparece em “Serviços aprovados a concluir”).</li>
          <li>Se a peça foi comprada e lançada pelo celular ligada à OS, vale o custo real; senão, o custo informado no orçamento.</li>
          <li>As demais despesas entram pela data de competência; lançamentos cancelados não entram.</li>
          <li>Taxas retidas pela maquininha entram como despesa financeira, no mês do recebimento.</li>
        </ul>
      </details>
    </div>
  );
}

function Grupo({
  titulo,
  valor,
  itens,
  pct,
  negativo,
}: {
  titulo: string;
  valor: number;
  itens: LinhaCategoria[];
  pct: (v: number) => string;
  negativo?: boolean;
}) {
  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="px-5 py-2.5 text-slate-700">{titulo}</td>
        <td className={`px-5 py-2.5 text-right ${negativo && valor !== 0 ? "text-red-600" : "text-slate-800"}`}>{formatCurrency(valor || 0)}</td>
        <td className="px-5 py-2.5 text-right text-xs text-slate-400">{pct(Math.abs(valor))}</td>
      </tr>
      {itens.length > 1 &&
        itens.map((c) => (
          <tr key={c.categoria} className="border-b border-slate-50 text-xs text-slate-500">
            <td className="py-1.5 pl-9 pr-5">{c.categoria}</td>
            <td className="px-5 py-1.5 text-right">{formatCurrency(negativo ? -c.valor || 0 : c.valor)}</td>
            <td className="px-5 py-1.5 text-right">{pct(c.valor)}</td>
          </tr>
        ))}
    </>
  );
}

function Total({ titulo, valor, pct, negativo }: { titulo: string; valor: number; pct: (v: number) => string; negativo?: boolean }) {
  return (
    <tr className="border-b border-slate-200 bg-slate-50">
      <td className="px-5 py-3 font-semibold text-slate-800">{titulo}</td>
      <td className={`px-5 py-3 text-right font-semibold ${negativo || valor < 0 ? "text-red-700" : "text-slate-900"}`}>{formatCurrency(valor || 0)}</td>
      <td className="px-5 py-3 text-right text-xs font-medium text-slate-500">{pct(Math.abs(valor))}</td>
    </tr>
  );
}

function Mini({ rotulo, valor, ajuda }: { rotulo: string; valor: string; ajuda?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-lg font-bold text-slate-900">{valor}</p>
      {ajuda && <p className="text-[11px] text-slate-400">{ajuda}</p>}
    </div>
  );
}
