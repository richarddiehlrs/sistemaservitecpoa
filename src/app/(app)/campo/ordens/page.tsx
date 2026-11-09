import Link from "next/link";
import { ArrowLeft, CalendarClock, ChevronRight, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth-guard";
import { StatusBadge } from "@/components/ui";
import { STATUS_OS_ABERTAS, ordenarOsPendentes } from "@/lib/os-status";
import { STATUS_OS_ATRASO } from "@/lib/alertas";
import { nomeTecnico } from "@/lib/permissoes";
import { formatDate, formatNumeroOS, hojeYmdLocal } from "@/lib/format";
import { TURNO_LABEL } from "@/lib/turnos";
import { ETAPAS, type EtapaOs } from "@/lib/etapas-os";

export const dynamic = "force-dynamic";

type Aba = "abertas" | "atrasadas" | "assinatura" | "ausente" | "concluidas";

const ABAS: { id: Aba; label: string }[] = [
  { id: "abertas", label: "Em aberto" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "assinatura", label: "Sem assinatura" },
  { id: "ausente", label: "Cliente ausente" },
  { id: "concluidas", label: "Concluídas (30 dias)" },
];

type OsLinha = {
  id: string;
  numero: number;
  status: string;
  prioridade: string | null;
  data_previsao: string | null;
  data_abertura: string | null;
  data_conclusao: string | null;
  turno: string | null;
  assinatura_tecnico: string | null;
  etapa_atual: string | null;
  defeito_relatado: string | null;
  clientes: { nome: string; bairro: string | null } | null;
};

/** Minhas OS (técnico em campo): só o que importa, separado em abas. */
export default async function MinhasOsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba: abaParam } = await searchParams;
  const aba: Aba = (ABAS.find((a) => a.id === abaParam)?.id ?? "abertas") as Aba;
  const profile = await requireProfile();
  const supabase = await createClient();
  const hoje = hojeYmdLocal();
  const d30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const colunas =
    "id, numero, status, prioridade, data_previsao, data_abertura, data_conclusao, turno, assinatura_tecnico, etapa_atual, defeito_relatado, clientes(nome, bairro)";

  let abertasQ = supabase.from("ordens_servico").select(colunas).in("status", [...STATUS_OS_ABERTAS]);
  let concluidasQ = supabase
    .from("ordens_servico")
    .select(colunas)
    .in("status", ["concluida", "entregue"])
    .gte("data_conclusao", d30)
    .order("data_conclusao", { ascending: false })
    .limit(50);
  if (profile.papel === "tecnico") {
    const nome = nomeTecnico(profile);
    abertasQ = abertasQ.or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${nome}%`);
    concluidasQ = concluidasQ.or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${nome}%`);
  }

  const [{ data: abertasRaw }, { data: concluidasRaw }] = await Promise.all([abertasQ, concluidasQ]);
  const abertas = ordenarOsPendentes((abertasRaw || []) as unknown as OsLinha[]);
  const atrasadas = abertas.filter(
    (o) => o.data_previsao && o.data_previsao < hoje && (STATUS_OS_ATRASO as readonly string[]).includes(o.status)
  );
  const semAssinatura = abertas.filter((o) => !o.assinatura_tecnico);
  const ausentes = abertas.filter((o) => o.status === "cliente_ausente");
  const concluidas = (concluidasRaw || []) as unknown as OsLinha[];

  const listas: Record<Aba, OsLinha[]> = {
    abertas,
    atrasadas,
    assinatura: semAssinatura,
    ausente: ausentes,
    concluidas,
  };
  const lista = listas[aba];

  return (
    <div className="mx-auto max-w-2xl pb-6">
      <Link href="/campo" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Campo
      </Link>
      <h1 className="mb-3 text-2xl font-bold text-slate-900">Minhas OS</h1>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {ABAS.map((a) => {
          const qtd = listas[a.id].length;
          const ativo = a.id === aba;
          const alerta = (a.id === "atrasadas" || a.id === "ausente") && qtd > 0;
          return (
            <Link
              key={a.id}
              href={`/campo/ordens?aba=${a.id}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                ativo ? "bg-brand-600 text-white" : alerta ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {a.label} <span className={ativo ? "opacity-80" : "text-slate-400"}>{qtd}</span>
            </Link>
          );
        })}
      </div>

      {lista.length === 0 ? (
        <p className="card px-4 py-10 text-center text-sm text-slate-400">Nenhuma OS nesta lista.</p>
      ) : (
        <ul className="space-y-2">
          {lista.map((o) => {
            const atrasada = o.data_previsao && o.data_previsao < hoje && aba !== "concluidas";
            return (
              <li key={o.id}>
                <Link href={`/ordens/${o.id}`} className="card flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{formatNumeroOS(o.numero)}</span>
                      <StatusBadge status={o.status} />
                      {o.prioridade === "urgente" || o.prioridade === "alta" ? (
                        <span className="badge bg-red-100 text-[10px] text-red-700">{o.prioridade}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-700">{o.clientes?.nome ?? "—"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      {o.clientes?.bairro && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" /> {o.clientes.bairro}
                        </span>
                      )}
                      {aba === "concluidas" ? (
                        o.data_conclusao && <span>concluída {formatDate(o.data_conclusao)}</span>
                      ) : (
                        o.data_previsao && (
                          <span className={`inline-flex items-center gap-0.5 ${atrasada ? "font-medium text-red-600" : ""}`}>
                            <CalendarClock className="h-3 w-3" />
                            {formatDate(o.data_previsao)}
                            {o.turno && TURNO_LABEL[o.turno] ? ` • ${TURNO_LABEL[o.turno]}` : ""}
                            {atrasada ? " (atrasada)" : ""}
                          </span>
                        )
                      )}
                      {o.etapa_atual && <span>{ETAPAS[o.etapa_atual as EtapaOs]?.label}</span>}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
