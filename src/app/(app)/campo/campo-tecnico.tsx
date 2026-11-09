import Link from "next/link";
import { Wrench, Plus, AlertTriangle, Calendar, Receipt, QrCode, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config";
import { PushAtivar } from "@/components/push-ativar";
import { STATUS_OS_ABERTAS, ordenarOsPendentes } from "@/lib/os-status";
import { STATUS_AGENDA_PENDENTE, STATUS_OS_ATRASO, hojeYmd } from "@/lib/alertas";
import { CampoAgendaDia, type VisitaCampoDia } from "@/components/campo-agenda-dia";
import { CompartilharGps } from "@/components/compartilhar-gps";
import { tecnicoDoProfile } from "@/lib/auth-guard";
import { calcComissaoTecnico, calcLucroOsSimples } from "@/lib/produtividade-tecnico";
import type { Profile } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import { saudacao } from "@/lib/mensagens-cliente";
import { InstalarIphone } from "@/components/instalar-iphone";
import { resumoFinanceiroOs } from "@/lib/os-valores";
import { registrarPosicaoTecnico } from "./actions";
import { MinhasDespesasCampo } from "./minhas-despesas";
import { checkinAgendamento, checkoutAgendamento, reagendarVisita } from "../agenda/actions";

export async function CampoTecnico({ profile }: { profile: Profile }) {
  const tecnico = tecnicoDoProfile(profile);
  const supabase = await createClient();
  const hoje = hojeYmd();
  const inicioMes = `${hoje.slice(0, 7)}-01`;

  const [
    { data: agendaHoje },
    { data: despesas },
    { data: osAbertas },
    { data: osConcluidasMes },
    config,
  ] = await Promise.all([
    supabase
      .from("agendamentos")
      .select("*, clientes(nome, telefone), ordens_servico(numero, valor_itens, valor_visita, abater_visita, desconto, acrescimo, motivo_atendimento, aprovado)")
      .eq("data", hoje)
      .or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${tecnico}%`)
      .neq("status", "cancelado")
      .order("hora_inicio"),
    supabase
      .from("lancamentos_financeiros")
      .select("id, descricao, valor, status, data_competencia, observacoes, created_at, comprovante_path, forma_pagamento")
      .eq("origem", "campo")
      .eq("criado_por", profile.id)
      .neq("status", "cancelado")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, prioridade, data_previsao, data_abertura, defeito_relatado, turno, assinatura_tecnico, clientes(nome, bairro, cidade)")
      .or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${tecnico}%`)
      .in("status", [...STATUS_OS_ABERTAS])
      .order("data_abertura", { ascending: false })
      .limit(30),
    supabase
      .from("ordens_servico")
      .select("valor_total, custo_total")
      .or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${tecnico}%`)
      .in("status", ["concluida", "entregue"])
      .gte("data_conclusao", inicioMes),
    getConfig(),
  ]);

  const osPendentes = ordenarOsPendentes(osAbertas || []);
  const osAtrasadas = (osAbertas || []).filter(
    (o) => o.data_previsao && o.data_previsao < hoje && STATUS_OS_ATRASO.includes(o.status as never)
  );
  const semAssinatura = (osAbertas || []).filter((o) => !o.assinatura_tecnico);
  const visitasPendentes = (agendaHoje || []).filter((a) =>
    STATUS_AGENDA_PENDENTE.includes(a.status as never)
  );
  const semCheckin = visitasPendentes.filter(
    (a) => (a.status === "agendado" || a.status === "confirmado") && !a.checkin_at
  );
  const emAtendimento = visitasPendentes.filter((a) => a.status === "em_atendimento");
  const atendimentoAtivo = emAtendimento[0];

  const totalDespesasMes = (despesas || [])
    .filter((d) => d.data_competencia?.startsWith(hoje.slice(0, 7)))
    .reduce((s, d) => s + Number(d.valor), 0);

  const lucroMes = (osConcluidasMes || []).reduce(
    (s, o) => s + calcLucroOsSimples(Number(o.valor_total), Number(o.custo_total || 0)),
    0
  );
  const comissaoMes = calcComissaoTecnico(lucroMes, config.comissao_percent);

  const osIdsAgenda = (visitasPendentes || [])
    .map((a) => a.os_id)
    .filter((id): id is string => Boolean(id));

  const { data: receitasOs } = osIdsAgenda.length
    ? await supabase
        .from("lancamentos_financeiros")
        .select("os_id, valor_pago")
        .in("os_id", osIdsAgenda)
        .eq("tipo", "receita")
        .neq("status", "cancelado")
    : { data: [] as { os_id: string; valor_pago: number | null }[] };

  const pagoPorOs = new Map(
    (receitasOs || []).map((r) => [r.os_id, Number(r.valor_pago) || 0])
  );

  const visitasSerializadas: VisitaCampoDia[] = visitasPendentes.map((a) => ({
    id: a.id,
    status: a.status,
    tipo: a.tipo,
    titulo: a.titulo,
    hora_inicio: a.hora_inicio,
    hora_fim: a.hora_fim,
    turno: a.turno,
    endereco: a.endereco,
    os_id: a.os_id,
    checkin_lat: a.checkin_lat,
    checkin_lng: a.checkin_lng,
    checkin_at: a.checkin_at,
    checkout_at: a.checkout_at,
    // @ts-expect-error relação
    clienteNome: a.clientes?.nome ?? null,
    // @ts-expect-error relação
    clienteTelefone: a.clientes?.telefone ?? null,
    // @ts-expect-error relação
    osNumero: a.ordens_servico?.numero ?? null,
    osResumo: a.ordens_servico
      ? resumoFinanceiroOs(
          {
          // @ts-expect-error relação
          valor_itens: Number(a.ordens_servico.valor_itens) || 0,
          // @ts-expect-error relação
          valor_visita: Number(a.ordens_servico.valor_visita) || 0,
          // @ts-expect-error relação
          abater_visita: Boolean(a.ordens_servico.abater_visita),
          // @ts-expect-error relação
          desconto: Number(a.ordens_servico.desconto) || 0,
          // @ts-expect-error relação
          acrescimo: Number(a.ordens_servico.acrescimo) || 0,
          motivo_atendimento: a.ordens_servico.motivo_atendimento,
          // @ts-expect-error relação
          aprovado: Boolean(a.ordens_servico.aprovado),
          },
          {
            valorPago: a.os_id ? pagoPorOs.get(a.os_id) ?? 0 : 0,
            visitaPaga: Boolean(a.ordens_servico.abater_visita),
          }
        )
      : null,
  }));

  const clienteAusente = (osAbertas || []).filter((o) => o.status === "cliente_ausente");
  const pendencias = [
    osAtrasadas.length > 0 && { href: "/campo/ordens?aba=atrasadas", texto: `${osAtrasadas.length} atrasada(s)`, tom: "text-red-700" },
    clienteAusente.length > 0 && { href: "/campo/ordens?aba=ausente", texto: `${clienteAusente.length} para reagendar`, tom: "text-red-700" },
    semCheckin.length > 0 && { href: "#visitas", texto: `${semCheckin.length} sem check-in`, tom: "text-amber-700" },
    semAssinatura.length > 0 && { href: "/campo/ordens?aba=assinatura", texto: `${semAssinatura.length} sem assinatura`, tom: "text-amber-700" },
  ].filter(Boolean) as { href: string; texto: string; tom: string }[];

  const dataHoje = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <InstalarIphone />

      {/* Cabeçalho do dia */}
      <div>
        <p className="text-sm capitalize text-slate-500">{dataHoje}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {saudacao(profile.nome || tecnico).replace("!", "")}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {visitasPendentes.length === 0
            ? "Nenhuma visita pendente hoje."
            : `${visitasPendentes.length} visita(s) hoje${emAtendimento.length ? " • 1 em atendimento" : ""}`}
        </p>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-4 gap-2">
        <AcaoRapida href="/ordens/nova" label="Nova OS" icon={<Plus className="h-5 w-5" />} destaque />
        <AcaoRapida href="/campo?nova-despesa=1" label="Despesa" icon={<Receipt className="h-5 w-5" />} />
        <AcaoRapida href="/escanear" label="Escanear" icon={<QrCode className="h-5 w-5" />} />
        <AcaoRapida href="/agenda" label="Agenda" icon={<Calendar className="h-5 w-5" />} />
      </div>

      {/* Pendências numa linha só */}
      {pendencias.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {pendencias.map((p) => (
            <Link key={p.texto} href={p.href} className={`font-medium hover:underline ${p.tom}`}>
              {p.texto}
            </Link>
          ))}
        </div>
      )}

      {/* Visitas de hoje — o trabalho do dia */}
      <div id="visitas" className="scroll-mt-20">
        <CampoAgendaDia
          visitas={visitasSerializadas}
          hoje={hoje}
          userId={profile.id}
          tecnicoNome={profile.nome || tecnico}
          checkinAgendamento={checkinAgendamento}
          checkoutAgendamento={checkoutAgendamento}
          reagendarAgendamento={reagendarVisita}
          empresa={config.nome}
          empresaTelefone={config.telefone}
          percentualSinalPadrao={config.percentual_sinal_padrao}
        />
      </div>

      {/* Minhas OS: só o atalho, sem a lista inteira */}
      <Link href="/campo/ordens" className="card flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <Wrench className="h-4 w-4 text-slate-400" /> Minhas ordens em aberto
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          {osPendentes.length} <ChevronRight className="h-4 w-4" />
        </span>
      </Link>

      <MinhasDespesasCampo profileId={profile.id} compacto />

      {/* Resumo do mês (recolhido) */}
      <details className="card group p-0">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm">
          <span className="font-medium text-slate-800">Resumo do mês</span>
          <span className="text-slate-500">
            {osConcluidasMes?.length || 0} OS concluída(s) <span className="ml-1 inline-block transition group-open:rotate-90">›</span>
          </span>
        </summary>
        <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 px-4 py-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">OS em aberto</dt>
            <dd className="font-semibold text-slate-900">{osAbertas?.length || 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Despesas do mês</dt>
            <dd className="font-semibold text-red-600">{formatCurrency(totalDespesasMes)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Lucro das OS concluídas</dt>
            <dd className="font-semibold text-slate-900">{formatCurrency(lucroMes)}</dd>
          </div>
          {config.comissao_percent > 0 && (
            <div>
              <dt className="text-xs text-slate-500">Comissão ({config.comissao_percent}%)</dt>
              <dd className="font-semibold text-amber-700">{formatCurrency(comissaoMes)}</dd>
            </div>
          )}
        </dl>
      </details>

      {/* Ajustes do app (recolhido) */}
      <details className="card group p-0">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm">
          <span className="font-medium text-slate-800">Notificações e localização</span>
          <span className="text-slate-500">
            {emAtendimento.length > 0 ? "em atendimento" : "ajustes"}{" "}
            <span className="ml-1 inline-block transition group-open:rotate-90">›</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-slate-100 p-4">
          <PushAtivar />
          <CompartilharGps
            action={registrarPosicaoTecnico}
            emAtendimento={emAtendimento.length > 0}
            agendamentoId={atendimentoAtivo?.id}
          />
        </div>
      </details>
    </div>
  );
}

function AcaoRapida({
  href,
  label,
  icon,
  destaque,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-3 text-xs font-medium transition active:scale-95 ${
        destaque ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
