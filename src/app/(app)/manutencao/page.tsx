import Link from "next/link";
import { AlertTriangle, Trash2, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { formatCurrency, formatDate, formatNumeroOS, STATUS_AGENDAMENTO_LABEL } from "@/lib/format";
import { filtrarAgendamentosOrfaos, filtrarLancamentosOrfaos } from "@/lib/orfaos";
import { listarOsInconsistentes } from "@/lib/reparar-os";
import {
  excluirAgendamentoOrfao,
  excluirLancamentoOrfao,
  limparTodosOrfaos,
  repararOsInconsistente,
  repararTodasOsInconsistentes,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ManutencaoPage() {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();

  const [{ data: osLista }, { data: agendamentos }, { data: lancamentos }, osInconsistentes] =
    await Promise.all([
    supabase.from("ordens_servico").select("id"),
    supabase
      .from("agendamentos")
      .select("id, titulo, data, status, tecnico, os_id")
      .order("data", { ascending: false }),
    supabase
      .from("lancamentos_financeiros")
      .select("id, descricao, tipo, valor, status, data_competencia, os_id")
      .order("data_competencia", { ascending: false }),
    listarOsInconsistentes(supabase),
  ]);

  const osIds = new Set((osLista || []).map((o) => o.id));
  const agOrfaos = filtrarAgendamentosOrfaos(agendamentos || [], osIds);
  const lancOrfaos = filtrarLancamentosOrfaos(lancamentos || [], osIds);
  const total = agOrfaos.length + lancOrfaos.length;

  return (
    <div>
      <PageHeader
        title="Manutenção de dados"
        subtitle="Corrija ordens com fluxo inconsistente e remova visitas/lançamentos órfãos"
        action={
          <div className="flex flex-wrap gap-2">
            {osInconsistentes.length > 0 && (
              <ConfirmButton
                action={repararTodasOsInconsistentes}
                className="btn-primary"
                title="Reparar todas as OS"
                message={`Deseja corrigir automaticamente ${osInconsistentes.length} ordem(ns) com inconsistências? Status, financeiro e agenda serão alinhados.`}
                confirmLabel="Reparar todas"
                successMsg={`${osInconsistentes.length} OS reparada(s).`}
              >
                <Wrench className="h-4 w-4" /> Reparar OS ({osInconsistentes.length})
              </ConfirmButton>
            )}
            {total > 0 ? (
              <ConfirmButton
                action={limparTodosOrfaos}
                className="btn-danger"
                title="Limpar todos os órfãos"
                message={`Deseja excluir ${agOrfaos.length} agendamento(s) e ${lancOrfaos.length} lançamento(s) órfãos?`}
                confirmLabel="Limpar tudo"
                successMsg="Dados órfãos removidos."
              >
                <Trash2 className="h-4 w-4" /> Limpar órfãos ({total})
              </ConfirmButton>
            ) : null}
          </div>
        }
      />

      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">
            OS com fluxo inconsistente ({osInconsistentes.length})
          </h2>
          <Link href="/ordens" className="text-sm text-brand-600 hover:underline">
            Ver ordens
          </Link>
        </div>
        {osInconsistentes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            Nenhuma ordem com problema detectado. Status, aprovação, financeiro e agenda estão alinhados.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {osInconsistentes.map((o) => (
              <div key={o.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/ordens/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                      {formatNumeroOS(o.numero)}
                    </Link>
                    <StatusBadge status={o.status} />
                    {o.aprovado && (
                      <span className="badge bg-green-100 text-green-800 text-[10px]">Aprovada</span>
                    )}
                  </div>
                  <p className="mt-1 text-slate-600">
                    {/* @ts-expect-error relação */}
                    {o.clientes?.nome || "Cliente"} • {o.tipo_atendimento}
                  </p>
                  <ul className="mt-2 list-inside list-disc text-xs text-amber-800">
                    {o.problemas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <ConfirmButton
                  action={repararOsInconsistente.bind(null, o.id)}
                  className="btn-secondary text-xs"
                  title="Reparar esta OS"
                  message={`Corrigir automaticamente ${formatNumeroOS(o.numero)}?`}
                  confirmLabel="Reparar"
                  successMsg={`${formatNumeroOS(o.numero)} reparada.`}
                >
                  <Wrench className="h-4 w-4" /> Reparar
                </ConfirmButton>
              </div>
            ))}
          </div>
        )}
      </div>

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
