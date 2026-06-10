import Link from "next/link";
import { ChevronLeft, ChevronRight, Check, X, MapPin, Clock, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AgendaForm } from "@/components/agenda-form";
import {
  TIPO_AGENDAMENTO_LABEL,
  TIPO_AGENDAMENTO_COLOR,
  formatHora,
  formatTelefone,
} from "@/lib/format";
import { criarAgendamento, alterarStatusAgendamento, excluirAgendamento } from "./actions";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function inicioSemana(base: Date) {
  const d = new Date(base);
  const dia = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDias(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string }>;
}) {
  const { inicio } = await searchParams;
  const baseDate = inicio ? new Date(inicio + "T00:00:00") : new Date();
  const segunda = inicioSemana(baseDate);
  const domingo = addDias(segunda, 6);
  const hojeStr = ymd(new Date());

  const supabase = await createClient();
  const { data: agendamentos } = await supabase
    .from("agendamentos")
    .select("*, clientes(nome, telefone)")
    .gte("data", ymd(segunda))
    .lte("data", ymd(domingo))
    .order("hora_inicio", { ascending: true });

  const semanaAnterior = ymd(addDias(segunda, -7));
  const proximaSemana = ymd(addDias(segunda, 7));

  const porDia = (dataStr: string) =>
    (agendamentos || []).filter((a) => a.data === dataStr);

  const periodoLabel = `${segunda.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${domingo.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div>
      <PageHeader
        title="Agenda de atendimentos"
        subtitle={`Semana de ${periodoLabel}`}
        action={<AgendaForm action={criarAgendamento} dataPadrao={hojeStr} />}
      />

      <div className="mb-4 flex items-center gap-2">
        <Link href={`/agenda?inicio=${semanaAnterior}`} className="btn-secondary">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Link>
        <Link href="/agenda" className="btn-secondary">Hoje</Link>
        <Link href={`/agenda?inicio=${proximaSemana}`} className="btn-secondary">
          Próxima <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
        {DIAS.map((nomeDia, i) => {
          const dia = addDias(segunda, i);
          const dataStr = ymd(dia);
          const itens = porDia(dataStr);
          const ehHoje = dataStr === hojeStr;
          return (
            <div
              key={i}
              className={`card flex flex-col ${ehHoje ? "ring-2 ring-brand-400" : ""}`}
            >
              <div className={`rounded-t-xl px-3 py-2 ${ehHoje ? "bg-brand-600 text-white" : "bg-slate-50 text-slate-700"}`}>
                <p className="text-xs font-semibold uppercase">{nomeDia}</p>
                <p className="text-sm">{dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {itens.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-slate-300">—</p>
                )}
                {itens.map((a) => {
                  // @ts-expect-error relação
                  const cli = a.clientes;
                  const cancelado = a.status === "cancelado";
                  const realizado = a.status === "realizado";
                  return (
                    <div
                      key={a.id}
                      className={`rounded-lg border-l-4 p-2 text-xs ${TIPO_AGENDAMENTO_COLOR[a.tipo] || ""} ${cancelado ? "opacity-50 line-through" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{TIPO_AGENDAMENTO_LABEL[a.tipo]}</span>
                        {(a.hora_inicio || a.hora_fim) && (
                          <span className="flex items-center gap-0.5 text-[10px]">
                            <Clock className="h-3 w-3" />
                            {formatHora(a.hora_inicio)}{a.hora_fim ? `-${formatHora(a.hora_fim)}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-medium text-slate-800">{a.titulo}</p>
                      {cli?.nome && <p className="text-slate-600">{cli.nome}</p>}
                      {cli?.telefone && (
                        <p className="flex items-center gap-0.5 text-slate-500">
                          <Phone className="h-3 w-3" /> {formatTelefone(cli.telefone)}
                        </p>
                      )}
                      {a.endereco && (
                        <p className="flex items-start gap-0.5 text-slate-500">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {a.endereco}
                        </p>
                      )}
                      {a.tecnico && <p className="text-slate-400">Téc.: {a.tecnico}</p>}
                      {realizado && <p className="mt-1 font-semibold text-green-700">✓ Realizado</p>}

                      {!cancelado && !realizado && (
                        <div className="mt-1 flex gap-1">
                          <form action={alterarStatusAgendamento.bind(null, a.id, "realizado")}>
                            <button className="rounded bg-white/70 p-1 text-green-600 hover:bg-white" title="Marcar realizado">
                              <Check className="h-3 w-3" />
                            </button>
                          </form>
                          <form action={excluirAgendamento.bind(null, a.id)}>
                            <button className="rounded bg-white/70 p-1 text-red-500 hover:bg-white" title="Excluir">
                              <X className="h-3 w-3" />
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
