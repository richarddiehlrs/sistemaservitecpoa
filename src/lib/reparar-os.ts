import type { SupabaseClient } from "@supabase/supabase-js";
import { sincronizarAgendamentoOs, sincronizarAgendaStatusOs } from "@/lib/agenda-os";
import { calcValorTotalCliente } from "@/lib/os-valores";
import {
  cancelarReceitaPendenteOs,
  criarReceitaPendenteOs,
  sincronizarFinanceiroOs,
  temReceitaAtivaOs,
} from "@/lib/os-financeiro";
import type { Database, StatusOS } from "@/types/database";

type Db = SupabaseClient<Database>;

export type OsInconsistente = {
  id: string;
  numero: number;
  status: StatusOS;
  aprovado: boolean;
  tipo_atendimento: string;
  clientes?: { nome?: string } | null;
  problemas: string[];
};

type OsRow = {
  id: string;
  numero: number;
  status: StatusOS;
  aprovado: boolean;
  valor_aprovado: number | null;
  tipo_atendimento: string;
  valor_itens: number;
  valor_visita: number;
  abater_visita: boolean;
  desconto: number;
  acrescimo: number;
  valor_total: number;
  custo_total: number;
  cliente_id: string;
  tecnico_id: string | null;
  tecnico: string | null;
  data_previsao: string | null;
  turno: string | null;
  clientes?: { nome?: string } | null;
};

function valorCalculado(os: OsRow): number {
  return calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
}

export function diagnosticarOs(
  os: OsRow,
  ctx: {
    receitaAtiva: boolean;
    receitaValor: number | null;
    agPendente: boolean;
    agEmAtendimento: boolean;
  }
): string[] {
  const problemas: string[] = [];
  const total = valorCalculado(os);

  if (Math.abs(total - Number(os.valor_total)) > 0.01) {
    problemas.push("valor_total desatualizado em relação aos itens");
  }

  if (os.aprovado && os.valor_aprovado == null) {
    problemas.push("aprovada sem valor_aprovado gravado");
  }

  if (os.aprovado && os.valor_aprovado != null && Math.abs(total - Number(os.valor_aprovado)) > 0.01) {
    problemas.push("valores alterados após aprovação (precisa reaprovar)");
  }

  if (os.aprovado && os.status === "aguardando_aprovacao") {
    problemas.push("marcada como aprovada, mas status ainda é aguardando aprovação");
  }

  if (!os.aprovado && os.status === "aprovada") {
    problemas.push("status aprovada sem flag de aprovação do cliente");
  }

  if (!os.aprovado && ctx.receitaAtiva) {
    problemas.push("receita no financeiro sem orçamento aprovado");
  }

  if (os.aprovado && !ctx.receitaAtiva && total > 0 && !["cancelada"].includes(os.status)) {
    problemas.push("orçamento aprovado sem receita no financeiro");
  }

  if (
    os.aprovado &&
    ctx.receitaValor != null &&
    Math.abs(ctx.receitaValor - total) > 0.01 &&
    Math.abs((os.valor_aprovado ?? total) - total) < 0.01
  ) {
    problemas.push("valor da receita diferente do total da OS");
  }

  if (
    os.tipo_atendimento === "domicilio" &&
    ["aberta", "em_analise"].includes(os.status) &&
    os.data_previsao
  ) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (os.data_previsao >= hoje) {
      problemas.push("visita agendada mas status ainda é aberta/em análise (deveria ser em roteiro)");
    }
  }

  if (
    os.tipo_atendimento === "domicilio" &&
    !os.aprovado &&
    os.status === "concluida" &&
    total > 0
  ) {
    problemas.push("concluída sem aprovação (fluxo antigo — deveria aguardar aprovação)");
  }

  if (["concluida", "entregue", "cancelada"].includes(os.status) && (ctx.agPendente || ctx.agEmAtendimento)) {
    problemas.push("agenda ainda pendente/em atendimento para OS finalizada");
  }

  if (
    os.tipo_atendimento === "domicilio" &&
    os.data_previsao &&
    os.tecnico_id &&
    ["aprovada", "aberta", "em_roteiro", "em_analise", "aguardando_aprovacao"].includes(os.status) &&
    !ctx.agPendente &&
    !ctx.agEmAtendimento
  ) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (os.data_previsao >= hoje) {
      problemas.push("data de visita futura sem agendamento na agenda");
    }
  }

  return problemas;
}

export async function listarOsInconsistentes(supabase: Db): Promise<OsInconsistente[]> {
  const { data: ordens } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, status, aprovado, valor_aprovado, tipo_atendimento, valor_itens, valor_visita, abater_visita, desconto, acrescimo, valor_total, custo_total, cliente_id, tecnico_id, tecnico, data_previsao, turno, clientes(nome)"
    )
    .neq("status", "cancelada")
    .order("numero", { ascending: false });

  if (!ordens?.length) return [];

  const ids = ordens.map((o) => o.id);

  const [{ data: lancamentos }, { data: agendamentos }] = await Promise.all([
    supabase
      .from("lancamentos_financeiros")
      .select("os_id, tipo, valor, status")
      .in("os_id", ids)
      .neq("status", "cancelado"),
    supabase
      .from("agendamentos")
      .select("os_id, status")
      .in("os_id", ids)
      .neq("status", "cancelado"),
  ]);

  const receitaPorOs = new Map<string, number>();
  for (const l of lancamentos || []) {
    if (l.tipo === "receita" && l.os_id) receitaPorOs.set(l.os_id, Number(l.valor));
  }

  const agPorOs = new Map<string, { pendente: boolean; emAtendimento: boolean }>();
  for (const a of agendamentos || []) {
    if (!a.os_id) continue;
    const cur = agPorOs.get(a.os_id) || { pendente: false, emAtendimento: false };
    if (["agendado", "confirmado"].includes(a.status)) cur.pendente = true;
    if (a.status === "em_atendimento") cur.emAtendimento = true;
    agPorOs.set(a.os_id, cur);
  }

  const resultado: OsInconsistente[] = [];

  for (const os of ordens as OsRow[]) {
    const ag = agPorOs.get(os.id) || { pendente: false, emAtendimento: false };
    const receitaValor = receitaPorOs.get(os.id) ?? null;
    const problemas = diagnosticarOs(os, {
      receitaAtiva: receitaValor != null,
      receitaValor,
      agPendente: ag.pendente,
      agEmAtendimento: ag.emAtendimento,
    });
    if (problemas.length > 0) {
      resultado.push({
        id: os.id,
        numero: os.numero,
        status: os.status,
        aprovado: os.aprovado,
        tipo_atendimento: os.tipo_atendimento,
        clientes: os.clientes,
        problemas,
      });
    }
  }

  return resultado;
}

export type ReparoResultado = {
  osId: string;
  numero: number;
  acoes: string[];
  avisos: string[];
};

export async function repararOs(supabase: Db, osId: string): Promise<ReparoResultado> {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, status, aprovado, valor_aprovado, tipo_atendimento, valor_itens, valor_visita, abater_visita, desconto, acrescimo, valor_total, custo_total, cliente_id, tecnico_id, tecnico, data_previsao, turno"
    )
    .eq("id", osId)
    .single();

  if (!os) throw new Error("OS não encontrada.");

  const row = os as OsRow;
  const acoes: string[] = [];
  const avisos: string[] = [];
  const total = valorCalculado(row);
  const update: Record<string, unknown> = {};

  if (Math.abs(total - Number(row.valor_total)) > 0.01) {
    update.valor_total = total;
    acoes.push(`valor_total atualizado para ${total.toFixed(2)}`);
  }

  const valorMudouAposAprovacao =
    row.aprovado &&
    row.valor_aprovado != null &&
    Math.abs(total - Number(row.valor_aprovado)) > 0.01;

  if (valorMudouAposAprovacao) {
    await cancelarReceitaPendenteOs(supabase, osId);
    update.aprovado = false;
    update.valor_aprovado = null;
    update.data_aprovacao = null;
    update.observacao_aprovacao = null;
    if (["aprovada", "em_execucao", "concluida"].includes(row.status)) {
      update.status = "aguardando_aprovacao";
    }
    acoes.push("aprovação resetada — valores mudaram após última assinatura");
  } else {
    if (row.aprovado && row.valor_aprovado == null) {
      update.valor_aprovado = total;
      acoes.push("valor_aprovado preenchido");
    }

    if (row.aprovado && row.status === "aguardando_aprovacao") {
      update.status = "aprovada";
      acoes.push("status corrigido para aprovada");
    }

    if (!row.aprovado && row.status === "aprovada") {
      update.status = "aguardando_aprovacao";
      acoes.push("status corrigido para aguardando_aprovacao");
    }

    if (
      row.tipo_atendimento === "domicilio" &&
      ["aberta", "em_analise"].includes(row.status) &&
      row.data_previsao
    ) {
      const hoje = new Date().toISOString().slice(0, 10);
      if (row.data_previsao >= hoje) {
        update.status = "em_roteiro";
        acoes.push("status corrigido para em roteiro (visita agendada)");
      }
    }

    if (
      row.tipo_atendimento === "domicilio" &&
      !row.aprovado &&
      row.status === "concluida" &&
      total > 0
    ) {
      update.status = "aguardando_aprovacao";
      acoes.push("status revertido de concluída para aguardando_aprovacao (fluxo domicílio)");
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("ordens_servico").update(update).eq("id", osId);
    if (error) throw new Error(error.message);
  }

  const { data: osAtualizada } = await supabase
    .from("ordens_servico")
    .select("aprovado, status")
    .eq("id", osId)
    .single();

  const aprovadoAgora = Boolean(osAtualizada?.aprovado);
  const statusAgora = (osAtualizada?.status || row.status) as StatusOS;

  if (!aprovadoAgora && (await temReceitaAtivaOs(supabase, osId))) {
    await cancelarReceitaPendenteOs(supabase, osId);
    acoes.push("receita pendente cancelada (sem aprovação)");
  }

  if (aprovadoAgora && !(await temReceitaAtivaOs(supabase, osId)) && total > 0) {
    const ok = await criarReceitaPendenteOs(supabase, osId);
    if (ok) acoes.push("receita pendente criada");
    else avisos.push("não foi possível criar receita automaticamente");
  }

  if (aprovadoAgora) {
    await sincronizarFinanceiroOs(supabase, osId, total, Number(row.custo_total) || 0);
    acoes.push("financeiro sincronizado");
  }

  await sincronizarAgendaStatusOs(supabase, osId, statusAgora);
  acoes.push("agenda alinhada ao status");

  if (
    row.tipo_atendimento === "domicilio" &&
    row.data_previsao &&
    row.tecnico_id &&
    row.tecnico &&
    !["concluida", "entregue", "cancelada"].includes(statusAgora)
  ) {
    await sincronizarAgendamentoOs(supabase, {
      osId,
      clienteId: row.cliente_id,
      numero: row.numero,
      data: row.data_previsao,
      turno: row.turno || "dia",
      tecnico: row.tecnico,
      tecnico_id: row.tecnico_id,
    });
    acoes.push("agendamento de visita verificado/criado");
  }

  if (acoes.length === 0) {
    avisos.push("nenhuma correção automática necessária");
  }

  await supabase.from("os_status_historico").insert({
    os_id: osId,
    status: statusAgora,
    observacao: `Reparo automático: ${acoes.join("; ") || "verificação sem alterações"}`,
  });

  return { osId, numero: row.numero, acoes, avisos };
}

export async function repararTodasOs(supabase: Db): Promise<ReparoResultado[]> {
  const inconsistentes = await listarOsInconsistentes(supabase);
  const resultados: ReparoResultado[] = [];
  for (const os of inconsistentes) {
    resultados.push(await repararOs(supabase, os.id));
  }
  return resultados;
}
