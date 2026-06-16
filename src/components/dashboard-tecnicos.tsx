import Link from "next/link";
import { UserCog } from "lucide-react";

export type MetricaTecnico = {
  id: string;
  nome: string;
  osAbertas: number;
  visitasHoje: number;
  visitasSemana: number;
  realizadosMes: number;
  despesasCampo: number;
};

export function DashboardTecnicos({ tecnicos }: { tecnicos: MetricaTecnico[] }) {
  if (tecnicos.length === 0) return null;

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <UserCog className="h-4 w-4" /> Produtividade por técnico
        </h2>
        <Link href="/agenda" className="text-sm font-medium text-brand-600 hover:underline">
          Ver agenda
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Técnico</th>
              <th className="text-center">OS abertas</th>
              <th className="text-center">Visitas hoje</th>
              <th className="text-center">Semana</th>
              <th className="text-center">Realizados (mês)</th>
              <th className="text-center">Desp. campo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tecnicos.map((t) => (
              <tr key={t.id}>
                <td className="font-medium text-slate-800">{t.nome}</td>
                <td className="text-center">{t.osAbertas}</td>
                <td className="text-center">
                  {t.visitasHoje > 0 ? (
                    <span className="badge bg-brand-100 text-brand-800">{t.visitasHoje}</span>
                  ) : (
                    "0"
                  )}
                </td>
                <td className="text-center">{t.visitasSemana}</td>
                <td className="text-center">{t.realizadosMes}</td>
                <td className="text-center">
                  {t.despesasCampo > 0 ? (
                    <span className="badge bg-amber-100 text-amber-800">{t.despesasCampo}</span>
                  ) : (
                    "0"
                  )}
                </td>
                <td className="text-right">
                  <Link
                    href={`/agenda?tecnico=${t.id}`}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Agenda →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">
        Semana = visitas pendentes de hoje até domingo • Realizados = check-outs no mês
      </p>
    </div>
  );
}
