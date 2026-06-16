import Link from "next/link";
import { UserCog, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config";
import { requirePermissao } from "@/lib/auth-guard";
import { mapTecnicos } from "@/lib/tecnicos";
import { PageHeader, StatCard } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  agruparLucroPorTecnico,
  contarVisitasAgenda,
  type OsLucroInput,
} from "@/lib/produtividade-tecnico";

export const dynamic = "force-dynamic";

function periodoMes(mesStr?: string) {
  const base = mesStr ? new Date(mesStr + "-01T00:00:00") : new Date();
  const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
  const fim = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    label: base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    value: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`,
  };
}

export default async function ProdutividadePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  await requirePermissao("relatorios");
  const periodo = periodoMes(mes);
  const supabase = await createClient();
  const config = await getConfig();

  const [{ data: perfis }, { data: ordens }, { data: agenda }] = await Promise.all([
    supabase.from("profiles").select("id, nome, email").eq("papel", "tecnico").eq("ativo", true).order("nome"),
    supabase
      .from("ordens_servico")
      .select("id, numero, tecnico, tecnico_id, valor_total, custo_total, status, data_abertura")
      .in("status", ["concluida", "entregue"])
      .gte("data_abertura", periodo.inicio)
      .lte("data_abertura", `${periodo.fim}T23:59:59`),
    supabase
      .from("agendamentos")
      .select("tecnico_id, status, data")
      .gte("data", periodo.inicio)
      .lte("data", periodo.fim)
      .neq("status", "cancelado"),
  ]);

  const tecnicosMap = new Map(mapTecnicos(perfis || []).map((t) => [t.id, t.nome]));

  const osInputs: OsLucroInput[] = (ordens || []).map((o) => ({
    id: o.id,
    tecnico: o.tecnico,
    tecnico_id: o.tecnico_id,
    valor_total: Number(o.valor_total),
    custo_total: o.custo_total,
  }));

  let linhas = agruparLucroPorTecnico(osInputs, config.comissao_percent, (o) => {
    if (o.tecnico_id && tecnicosMap.has(o.tecnico_id)) {
      return tecnicosMap.get(o.tecnico_id)!;
    }
    return o.tecnico?.trim() || "Sem técnico";
  });

  linhas = contarVisitasAgenda(linhas, agenda || []).map((l) => ({
    ...l,
    nome: l.tecnicoId && tecnicosMap.has(l.tecnicoId) ? tecnicosMap.get(l.tecnicoId)! : l.nome,
  }));

  for (const t of mapTecnicos(perfis || [])) {
    if (!linhas.some((l) => l.tecnicoId === t.id)) {
      linhas.push({
        tecnicoId: t.id,
        nome: t.nome,
        osConcluidas: 0,
        visitasRealizadas: 0,
        visitasPendentes: 0,
        receita: 0,
        lucro: 0,
        comissao: 0,
      });
    }
  }

  linhas = linhas.sort((a, b) => b.lucro - a.lucro || b.visitasRealizadas - a.visitasRealizadas);

  const totalComissao = linhas.reduce((s, l) => s + l.comissao, 0);
  const totalLucro = linhas.reduce((s, l) => s + l.lucro, 0);
  const visitasRealizadas = linhas.reduce((s, l) => s + l.visitasRealizadas, 0);

  return (
    <div>
      <PageHeader
        title="Produtividade por técnico"
        subtitle={`Visitas e OS concluídas — ${periodo.label}`}
        action={
          <Link href="/relatorios" className="btn-secondary">
            Relatórios gerais
          </Link>
        }
      />

      <form className="mb-6 flex items-center gap-2" action="/relatorios/produtividade" method="get">
        <input type="month" name="mes" defaultValue={periodo.value} className="input max-w-[180px]" />
        <button className="btn-secondary">Filtrar</button>
      </form>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Lucro bruto (OS)"
          value={formatCurrency(totalLucro)}
          tone="green"
          icon={<UserCog className="h-5 w-5" />}
        />
        <StatCard
          title="Comissão estimada"
          value={formatCurrency(totalComissao)}
          tone="amber"
          icon={<Trophy className="h-5 w-5" />}
          hint={`${config.comissao_percent}% sobre lucro`}
        />
        <StatCard title="Visitas realizadas" value={String(visitasRealizadas)} tone="blue" />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Técnico</th>
              <th className="text-center">OS concluídas</th>
              <th className="text-center">Visitas ok</th>
              <th className="text-center">Visitas pend.</th>
              <th className="text-right">Receita</th>
              <th className="text-right">Lucro</th>
              <th className="text-right">Comissão</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((t) => (
              <tr key={t.tecnicoId || t.nome}>
                <td className="font-medium text-slate-800">{t.nome}</td>
                <td className="text-center">{t.osConcluidas}</td>
                <td className="text-center">{t.visitasRealizadas}</td>
                <td className="text-center">{t.visitasPendentes}</td>
                <td className="text-right">{formatCurrency(t.receita)}</td>
                <td className="text-right text-green-600">{formatCurrency(t.lucro)}</td>
                <td className="text-right font-semibold text-amber-600">{formatCurrency(t.comissao)}</td>
                <td className="text-right">
                  {t.tecnicoId && (
                    <Link
                      href={`/agenda?tecnico=${t.tecnicoId}`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Agenda
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {config.comissao_percent === 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Defina o percentual de comissão em Configurações para calcular valores neste relatório.
        </p>
      )}
    </div>
  );
}
