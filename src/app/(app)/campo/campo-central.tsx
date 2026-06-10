import Link from "next/link";
import { MapPin, Wrench, Clock, Navigation, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { TecnicosMapa, LinkMapaCheckin } from "@/components/tecnicos-mapa";
import { formatCurrency, formatDate, formatHora, formatNumeroOS, formatTelefone, TIPO_AGENDAMENTO_LABEL } from "@/lib/format";
import { linkMapa } from "@/lib/geo";

export async function CampoCentral() {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const limiteGps = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const [
    { data: tecnicos },
    { data: posicoes },
    { data: agendaHoje },
    { data: osCampo },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("papel", "tecnico").eq("ativo", true).order("nome"),
    supabase.from("posicoes_tecnico").select("*").gte("atualizado_at", limiteGps).order("atualizado_at", { ascending: false }),
    supabase
      .from("agendamentos")
      .select("*, clientes(nome, telefone)")
      .eq("data", hoje)
      .neq("status", "cancelado")
      .order("hora_inicio"),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, tecnico, tecnico_id, clientes(nome)")
      .in("status", ["em_roteiro", "em_execucao", "cliente_ausente"])
      .order("data_abertura", { ascending: false })
      .limit(30),
  ]);

  const listaTecnicos = tecnicos || [];
  const posMap = new Map((posicoes || []).map((p) => [p.user_id, p]));
  const emAtendimento = (agendaHoje || []).filter((a) => a.status === "em_atendimento").length;

  return (
    <div>
      <PageHeader
        title="Central de campo"
        subtitle="Localização dos técnicos, atendimentos e ordens em andamento"
        action={
          <Link href="/agenda" className="btn-secondary">
            <Clock className="h-4 w-4" /> Agenda completa
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Técnicos ativos" value={String(listaTecnicos.length)} icon={<User className="h-5 w-5" />} tone="blue" />
        <StatCard title="Com GPS online" value={String(posicoes?.length || 0)} icon={<Navigation className="h-5 w-5" />} tone="green" />
        <StatCard title="Em atendimento" value={String(emAtendimento)} tone="amber" />
        <StatCard title="OS em campo" value={String(osCampo?.length || 0)} icon={<Wrench className="h-5 w-5" />} />
      </div>

      <TecnicosMapa posicoes={(posicoes || []) as never[]} />

      {/* Equipe */}
      <div className="card mb-6 p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Equipe técnica</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listaTecnicos.map((t) => {
            const pos = posMap.get(t.id);
            const atendimentos = (agendaHoje || []).filter(
              (a) =>
                a.tecnico_id === t.id ||
                a.checkin_por === t.id ||
                (a.tecnico?.toLowerCase().includes((t.nome || "").toLowerCase()) ?? false)
            );
            const osDoTecnico = (osCampo || []).filter(
              (o) => o.tecnico_id === t.id || o.tecnico?.toLowerCase().includes((t.nome || "").toLowerCase())
            );
            const emServico = atendimentos.some((a) => a.status === "em_atendimento");
            return (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{t.nome || t.email}</p>
                    {t.email && <p className="text-xs text-slate-400">{t.email}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      {atendimentos.length} atendimento(s) hoje
                      {osDoTecnico.length > 0 && ` • ${osDoTecnico.length} OS em campo`}
                      {emServico && <span className="ml-1 font-semibold text-green-600">• Em serviço</span>}
                    </p>
                  </div>
                  {pos && (
                    <Link
                      href={linkMapa(Number(pos.lat), Number(pos.lng))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary shrink-0 px-2 py-1 text-xs"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                {!pos && <p className="mt-2 text-[11px] text-slate-400">GPS offline ou não compartilhado</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda do dia — todos os técnicos */}
      <div className="card mb-6 p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Atendimentos de hoje</h2>
        {!agendaHoje || agendaHoje.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Nenhum atendimento agendado para hoje.</p>
        ) : (
          <div className="space-y-2">
            {agendaHoje.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {formatHora(a.hora_inicio)} — {TIPO_AGENDAMENTO_LABEL[a.tipo]}: {a.titulo}
                  </p>
                  <p className="text-xs text-slate-500">
                    Téc.: {a.tecnico || "—"}
                    {/* @ts-expect-error relação */}
                    {a.clientes?.nome && ` • ${a.clientes.nome}`}
                    {/* @ts-expect-error relação */}
                    {a.clientes?.telefone && ` • ${formatTelefone(a.clientes.telefone)}`}
                  </p>
                  {a.endereco && (
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin className="h-3 w-3" /> {a.endereco}
                    </p>
                  )}
                  <LinkMapaCheckin lat={a.checkin_lat} lng={a.checkin_lng} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${a.status === "em_atendimento" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                    {a.status === "em_atendimento" ? "Em atendimento" : a.status}
                  </span>
                  {a.os_id && (
                    <Link href={`/ordens/${a.os_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                      Ver OS
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OS em campo */}
      <div className="card p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Ordens em campo</h2>
        {!osCampo || osCampo.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Nenhuma OS em roteiro ou execução.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Cliente</th>
                  <th>Técnico</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {osCampo.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/ordens/${o.id}`} className="font-medium text-brand-600 hover:underline">
                        {formatNumeroOS(o.numero)}
                      </Link>
                    </td>
                    {/* @ts-expect-error relação */}
                    <td>{o.clientes?.nome || "—"}</td>
                    <td>{o.tecnico || "—"}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
