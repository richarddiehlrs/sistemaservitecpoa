import Link from "next/link";
import { ArrowLeft, Fuel, Receipt, Wallet, Gauge } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { HBarList } from "@/components/charts";
import { ExportCsv } from "@/components/export-csv";
import { formatCurrency, formatDate, formatNumeroOS, hojeYmdLocal } from "@/lib/format";
import { periodoMes } from "@/lib/conciliacao-saldo";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  forma_pagamento: string | null;
  tecnico: string | null;
  km_veiculo: number | null;
  litros: number | null;
  comprovante_path: string | null;
  os_id: string | null;
  categorias_financeiras: { nome: string } | null;
  ordens_servico: { numero: number } | null;
};

/** Gastos lançados em campo (combustível, peças, alimentação…) por mês. */
export default async function DespesasCampoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  await requirePermissao("financeiro");
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hojeYmdLocal().slice(0, 7);
  const { inicio, fim, label } = periodoMes(mes);
  const supabase = await createClient();

  const { data } = await supabase
    .from("lancamentos_financeiros")
    .select("id, descricao, valor, data_competencia, forma_pagamento, tecnico, km_veiculo, litros, comprovante_path, os_id, categorias_financeiras(nome), ordens_servico(numero)")
    .eq("origem", "campo")
    .eq("tipo", "despesa")
    .neq("status", "cancelado")
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim)
    .order("data_competencia")
    .limit(2000);
  const lista = (data || []) as unknown as Row[];

  const total = lista.reduce((s, l) => s + Number(l.valor), 0);
  const porCategoria = new Map<string, number>();
  for (const l of lista) {
    const c = l.categorias_financeiras?.nome ?? "Sem categoria";
    porCategoria.set(c, (porCategoria.get(c) ?? 0) + Number(l.valor));
  }
  const categorias = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: "bg-red-500" }));

  // Combustível: km rodados entre o primeiro e o último registro de km do mês
  const comb = lista.filter((l) => /combust/i.test(l.categorias_financeiras?.nome ?? ""));
  const gastoComb = comb.reduce((s, l) => s + Number(l.valor), 0);
  const litros = comb.reduce((s, l) => s + Number(l.litros || 0), 0);
  const kms = comb.map((l) => l.km_veiculo).filter((k): k is number => k != null).sort((a, b) => a - b);
  const kmRodados = kms.length >= 2 ? kms[kms.length - 1] - kms[0] : null;
  // O último abastecimento é para o próximo período: não entra no custo por km
  const ultimoComKm = [...comb].reverse().find((l) => l.km_veiculo != null);
  const gastoParaKm = kmRodados ? gastoComb - Number(ultimoComKm?.valor ?? 0) : 0;
  const litrosParaKm = kmRodados ? litros - Number(ultimoComKm?.litros ?? 0) : 0;
  const custoKm = kmRodados && kmRodados > 0 ? gastoParaKm / kmRodados : null;
  const kmPorLitro = kmRodados && litrosParaKm > 0 ? kmRodados / litrosParaKm : null;

  const pecasOs = lista.filter((l) => l.os_id && /pe[çc]as/i.test(l.categorias_financeiras?.nome ?? ""));
  const semComprovante = lista.filter((l) => !l.comprovante_path).length;

  return (
    <div>
      <Link href="/financeiro" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Financeiro
      </Link>
      <PageHeader
        title="Despesas de campo"
        subtitle={`Gastos lançados pelo celular — ${label}`}
        action={
          <ExportCsv
            filename={`despesas-campo-${mes}.csv`}
            headers={["Data", "Categoria", "Descrição", "Valor", "Forma", "OS", "Km", "Litros", "Comprovante"]}
            rows={lista.map((l) => [
              formatDate(l.data_competencia),
              l.categorias_financeiras?.nome ?? "",
              l.descricao,
              Number(l.valor).toFixed(2).replace(".", ","),
              l.forma_pagamento ?? "",
              l.ordens_servico ? formatNumeroOS(l.ordens_servico.numero) : "",
              l.km_veiculo ?? "",
              l.litros != null ? String(l.litros).replace(".", ",") : "",
              l.comprovante_path ? "sim" : "não",
            ])}
          />
        }
      />

      <form action="/financeiro/despesas-campo" method="get" className="mb-4 flex items-center gap-2">
        <input type="month" name="mes" defaultValue={mes} className="input max-w-[180px]" />
        <button className="btn-secondary">Ver mês</button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Total gasto" value={formatCurrency(total)} hint={`${lista.length} lançamento(s)`} tone="red" icon={<Wallet className="h-5 w-5" />} />
        <StatCard
          title="Combustível"
          value={formatCurrency(gastoComb)}
          hint={litros > 0 ? `${litros.toLocaleString("pt-BR")} L • ${formatCurrency(gastoComb / litros)}/L` : "Informe os litros ao abastecer"}
          icon={<Fuel className="h-5 w-5" />}
        />
        <StatCard
          title="Custo por km"
          value={custoKm != null ? formatCurrency(custoKm) : "—"}
          hint={
            kmRodados != null
              ? `${kmRodados.toLocaleString("pt-BR")} km rodados${kmPorLitro ? ` • ${kmPorLitro.toFixed(1).replace(".", ",")} km/L` : ""}`
              : "Informe o km em 2+ abastecimentos no mês"
          }
          icon={<Gauge className="h-5 w-5" />}
        />
        <StatCard
          title="Sem comprovante"
          value={String(semComprovante)}
          hint={semComprovante ? "Lançamentos sem foto da nota" : "Todos com comprovante"}
          tone={semComprovante ? "amber" : "green"}
          icon={<Receipt className="h-5 w-5" />}
        />
      </div>

      {lista.length === 0 ? (
        <EmptyState title="Nenhuma despesa de campo neste mês" description="Lance pelo celular em Campo → Lançar despesa." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Por categoria</h3>
              <HBarList items={categorias} formatValue={(v) => formatCurrency(v)} />
            </div>
            {pecasOs.length > 0 && (
              <div className="card p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Peças compradas para OS</h3>
                <ul className="space-y-1 text-sm">
                  {pecasOs.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <Link href={`/ordens/${l.os_id}`} className="truncate hover:underline">
                        {l.ordens_servico ? formatNumeroOS(l.ordens_servico.numero) : "OS"} • {l.descricao.replace(/^Peças \/ material — /, "")}
                      </Link>
                      <strong>{formatCurrency(Number(l.valor))}</strong>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-slate-500">Já contam no custo e no lucro de cada OS.</p>
              </div>
            )}
          </div>

          <div className="card overflow-x-auto">
            <table className="table-base text-sm">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Despesa</th>
                  <th>Forma</th>
                  <th className="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{formatDate(l.data_competencia)}</td>
                    <td>
                      <Link href={`/financeiro/lancamentos/${l.id}`} className="font-medium hover:underline">
                        {l.descricao}
                      </Link>
                      <span className="block text-xs text-slate-400">
                        {l.categorias_financeiras?.nome}
                        {l.ordens_servico ? ` • ${formatNumeroOS(l.ordens_servico.numero)}` : ""}
                        {l.km_veiculo != null ? ` • ${l.km_veiculo.toLocaleString("pt-BR")} km` : ""}
                        {l.comprovante_path ? " • com comprovante" : " • sem comprovante"}
                      </span>
                    </td>
                    <td className="text-xs">{l.forma_pagamento ?? "—"}</td>
                    <td className="text-right font-semibold text-red-600">{formatCurrency(Number(l.valor))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
