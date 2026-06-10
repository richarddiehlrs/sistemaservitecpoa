import Link from "next/link";
import { AlertTriangle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { formatCurrency, formatDate, STATUS_AGENDAMENTO_LABEL } from "@/lib/format";
import { filtrarAgendamentosOrfaos, filtrarLancamentosOrfaos } from "@/lib/orfaos";
import {
  excluirAgendamentoOrfao,
  excluirLancamentoOrfao,
  limparTodosOrfaos,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ManutencaoPage() {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();

  const [{ data: osLista }, { data: agendamentos }, { data: lancamentos }] = await Promise.all([
    supabase.from("ordens_servico").select("id"),
    supabase
      .from("agendamentos")
      .select("id, titulo, data, status, tecnico, os_id")
      .order("data", { ascending: false }),
    supabase
      .from("lancamentos_financeiros")
      .select("id, descricao, tipo, valor, status, data_competencia, os_id")
      .order("data_competencia", { ascending: false }),
  ]);

  const osIds = new Set((osLista || []).map((o) => o.id));
  const agOrfaos = filtrarAgendamentosOrfaos(agendamentos || [], osIds);
  const lancOrfaos = filtrarLancamentosOrfaos(lancamentos || [], osIds);
  const total = agOrfaos.length + lancOrfaos.length;

  return (
    <div>
      <PageHeader
        title="Manutenção de dados"
        subtitle="Remova manualmente visitas e lançamentos órfãos (de OS excluídas antes da limpeza automática)"
        action={
          total > 0 ? (
            <ConfirmButton
              action={limparTodosOrfaos}
              className="btn-danger"
              title="Limpar todos os órfãos"
              message={`Deseja excluir ${agOrfaos.length} agendamento(s) e ${lancOrfaos.length} lançamento(s) órfãos?`}
              confirmLabel="Limpar tudo"
              successMsg="Dados órfãos removidos."
            >
              <Trash2 className="h-4 w-4" /> Limpar tudo ({total})
            </ConfirmButton>
          ) : undefined
        }
      />

      {total === 0 ? (
        <div className="card flex items-center gap-3 p-6 text-slate-600">
          <AlertTriangle className="h-6 w-6 text-green-500" />
          Nenhum dado órfão encontrado. Agenda, financeiro e campo estão sincronizados.
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Encontrados <strong>{total}</strong> registro(s) sem OS válida. Exclua individualmente ou use &quot;Limpar tudo&quot;.
        </div>
      )}

      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">
            Agenda órfã ({agOrfaos.length})
          </h2>
          <Link href="/agenda" className="text-sm text-brand-600 hover:underline">
            Ir para agenda
          </Link>
        </div>
        {agOrfaos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhuma visita órfã.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {agOrfaos.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{a.titulo}</p>
                  <p className="text-slate-500">
                    {formatDate(a.data)} • {STATUS_AGENDAMENTO_LABEL[a.status] || a.status}
                    {a.tecnico && ` • ${a.tecnico}`}
                  </p>
                  <p className="text-xs text-amber-700">
                    {a.motivo === "os_inexistente" ? "OS vinculada não existe mais" : "Visita sem OS (órfã)"}
                  </p>
                </div>
                <ConfirmButton
                  action={excluirAgendamentoOrfao.bind(null, a.id)}
                  className="btn-danger text-xs"
                  title="Excluir agendamento"
                  message={`Excluir "${a.titulo}" da agenda?`}
                  confirmLabel="Excluir"
                  successMsg="Agendamento removido."
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </ConfirmButton>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">
            Financeiro órfão ({lancOrfaos.length})
          </h2>
          <Link href="/financeiro" className="text-sm text-brand-600 hover:underline">
            Ir para financeiro
          </Link>
        </div>
        {lancOrfaos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Nenhum lançamento órfão.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {lancOrfaos.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{l.descricao}</p>
                  <p className="text-slate-500">
                    {formatDate(l.data_competencia)} • {l.tipo} • {l.status} • {formatCurrency(l.valor)}
                  </p>
                  <p className="text-xs text-amber-700">
                    {l.motivo === "os_inexistente" ? "OS vinculada não existe mais" : "Lançamento de OS excluída"}
                  </p>
                </div>
                <ConfirmButton
                  action={excluirLancamentoOrfao.bind(null, l.id)}
                  className="btn-danger text-xs"
                  title="Excluir lançamento"
                  message={`Excluir "${l.descricao}" do financeiro?`}
                  confirmLabel="Excluir"
                  successMsg="Lançamento removido."
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </ConfirmButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
