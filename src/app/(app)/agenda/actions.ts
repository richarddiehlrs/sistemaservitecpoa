"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { nomeTecnico } from "@/lib/permissoes";
import { horarioTurno } from "@/lib/turnos";
import { hojeYmdLocal } from "@/lib/format";
import { transicionarStatusOs } from "@/lib/transicao-os";
import { statusPosCheckout, statusPermiteCheckin, type CheckoutResultado } from "@/lib/transicao-status";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { sincronizarAgendamentoOs } from "@/lib/agenda-os";
import { requererReaprovacaoSeValoresMudaram } from "@/lib/aprovacao-os";
import { notificarWhatsAppClienteSugerido } from "@/lib/notificacoes";
import { salvarPosicaoTecnico } from "@/lib/posicao-tecnico";
import {
  checkinBloqueadoPorAprovacao,
  mensagemCheckinBloqueado,
} from "@/lib/checkin-os";
import { criarReceitaPendenteOs, registrarReceitaVisitaCheckout } from "@/lib/os-financeiro";

async function garantirAtribuicaoCampo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Awaited<ReturnType<typeof requirePermissao>>,
  opts: { agendamentoId: string; osId?: string | null }
) {
  if (profile.papel !== "tecnico") return;
  const nome = nomeTecnico(profile);

  const { error: agErr } = await supabase
    .from("agendamentos")
    .update({ tecnico_id: profile.id, tecnico: nome })
    .eq("id", opts.agendamentoId);
  if (agErr) throw new Error(agErr.message);

  if (opts.osId) {
    const { error: osErr } = await supabase
      .from("ordens_servico")
      .update({ tecnico_id: profile.id, tecnico: nome })
      .eq("id", opts.osId);
    if (osErr) throw new Error(osErr.message);
  }
}

function assertSupabaseOk(error: { message: string } | null, ctx: string) {
  if (error) throw new Error(`${ctx}: ${error.message}`);
}

function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

function coord(v: FormDataEntryValue | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type AgEstado = {
  id: string;
  status: string;
  checkin_at: string | null;
  checkout_at: string | null;
  tecnico_id: string | null;
  os_id: string | null;
};

async function carregarAgendamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<AgEstado & { tecnico: string | null }> {
  const { data: ag } = await supabase
    .from("agendamentos")
    .select("id, status, checkin_at, checkout_at, tecnico_id, os_id, tecnico")
    .eq("id", id)
    .single();
  if (!ag) throw new Error("Agendamento não encontrado.");
  return ag;
}

function validarCheckinAgenda(ag: AgEstado): void {
  if (ag.status === "cancelado") throw new Error("Este agendamento foi cancelado.");
  if (ag.status === "realizado") throw new Error("Esta visita já foi finalizada.");
  if (ag.checkin_at) throw new Error("Check-in já registrado nesta visita.");
}

function validarCheckoutAgenda(ag: AgEstado): void {
  if (ag.status === "cancelado") throw new Error("Este agendamento foi cancelado.");
  if (ag.status === "realizado") throw new Error("Esta visita já foi finalizada.");
  if (!ag.checkin_at) throw new Error("Faça o check-in antes do check-out.");
  if (ag.checkout_at) throw new Error("Check-out já registrado nesta visita.");
}

async function assertUmaVisitaEmAtendimento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  agendamentoId: string
): Promise<void> {
  const { count } = await supabase
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .eq("tecnico_id", profileId)
    .eq("status", "em_atendimento")
    .neq("id", agendamentoId);
  if ((count ?? 0) > 0) {
    throw new Error("Finalize a visita em andamento antes de iniciar outra.");
  }
}

async function resolverTecnicoAgenda(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
): Promise<{ tecnico_id: string; tecnico: string }> {
  const tecnico_id = String(formData.get("tecnico_id") || "").trim();
  if (!tecnico_id) throw new Error("Selecione o técnico responsável.");
  const { data: t } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", tecnico_id)
    .eq("papel", "tecnico")
    .eq("ativo", true)
    .single();
  if (!t) throw new Error("Técnico inválido ou inativo.");
  return { tecnico_id: t.id, tecnico: nomeTecnico(t) };
}

export async function criarAgendamento(formData: FormData) {
  await requirePermissao("agenda_criar");
  const supabase = await createClient();

  const turno = str(formData.get("turno"));
  const horas = horarioTurno(turno);
  const { tecnico_id, tecnico } = await resolverTecnicoAgenda(supabase, formData);
  const osId = str(formData.get("os_id"));
  const data = str(formData.get("data")) || hojeYmdLocal();

  if (osId) {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("cliente_id, numero, tipo_atendimento")
      .eq("id", osId)
      .single();
    if (!os) throw new Error("Ordem de serviço não encontrada.");
    if (os.tipo_atendimento !== "domicilio") {
      throw new Error("Só é possível vincular agendamento a OS domicílio.");
    }

    await supabase
      .from("ordens_servico")
      .update({
        data_previsao: data,
        turno: (turno as never) || "manha",
        tecnico_id,
        tecnico,
      })
      .eq("id", osId);

    await sincronizarAgendamentoOs(supabase, {
      osId,
      clienteId: os.cliente_id,
      numero: os.numero,
      data,
      turno: turno || "dia",
      tecnico,
      tecnico_id,
    });
  } else {
    const { error } = await supabase.from("agendamentos").insert({
      titulo: String(formData.get("titulo") || "").trim() || "Atendimento",
      tipo: (str(formData.get("tipo")) as never) || "visita",
      turno: turno as never,
      data,
      hora_inicio: str(formData.get("hora_inicio")) || horas.inicio,
      hora_fim: str(formData.get("hora_fim")) || horas.fim,
      tecnico,
      tecnico_id,
      endereco: str(formData.get("endereco")),
      cliente_id: str(formData.get("cliente_id")),
      os_id: null,
      status: (str(formData.get("status")) as never) || "agendado",
      observacoes: str(formData.get("observacoes")),
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/painel");
  if (osId) revalidatePath(`/ordens/${osId}`);
}

export async function alterarStatusAgendamento(id: string, status: string) {
  await requirePermissao("agenda_criar");
  const supabase = await createClient();
  const { error } = await supabase
    .from("agendamentos")
    .update({ status: status as never })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}

export async function excluirAgendamento(id: string) {
  await requirePermissao("agenda_criar");
  const supabase = await createClient();
  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/manutencao");
}

async function validarAgendamentoTecnico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  profile: Awaited<ReturnType<typeof requirePermissao>>
) {
  const { data: ag } = await supabase
    .from("agendamentos")
    .select("tecnico, tecnico_id")
    .eq("id", id)
    .single();
  if (!ag) throw new Error("Agendamento não encontrado.");
  if (profile.papel === "tecnico") {
    if (ag.tecnico_id && ag.tecnico_id !== profile.id) {
      throw new Error("Este atendimento não está atribuído a você.");
    }
    const nome = nomeTecnico(profile);
    const atribuido = ag.tecnico?.trim();
    if (!ag.tecnico_id && atribuido && !atribuido.toLowerCase().includes(nome.toLowerCase())) {
      throw new Error("Este atendimento não está atribuído a você.");
    }
  }
}

export async function checkinAgendamento(id: string, formData?: FormData) {
  const profile = await requirePermissao("agenda_checkin");
  const supabase = await createClient();
  await validarAgendamentoTecnico(supabase, id, profile);

  const ag = await carregarAgendamento(supabase, id);
  validarCheckinAgenda(ag);

  await garantirAtribuicaoCampo(supabase, profile, {
    agendamentoId: id,
    osId: ag.os_id,
  });

  if (profile.papel === "tecnico") {
    await assertUmaVisitaEmAtendimento(supabase, profile.id, id);
  }

  const lat = coord(formData?.get("lat"));
  const lng = coord(formData?.get("lng"));
  const precisao = coord(formData?.get("precisao"));

  const nome = nomeTecnico(profile);
  const assumir = !ag.tecnico_id && !ag.tecnico?.trim();
  const updates: Record<string, string | number | null> = {
    checkin_at: new Date().toISOString(),
    checkin_por: profile.id,
    status: "em_atendimento",
    checkin_lat: lat,
    checkin_lng: lng,
  };
  if (assumir || profile.papel === "tecnico") {
    updates.tecnico = nome;
    updates.tecnico_id = profile.id;
  }

  const { error: errAgenda } = await supabase.from("agendamentos").update(updates).eq("id", id);
  if (errAgenda) throw new Error(errAgenda.message);

  if (ag.os_id) {
    try {
      const { data: osCheckin } = await supabase
        .from("ordens_servico")
        .select("status, aprovado")
        .eq("id", ag.os_id)
        .single();

      const { data: histRows } = await supabase
        .from("os_status_historico")
        .select("status")
        .eq("os_id", ag.os_id);

      const histStatuses = (histRows || []).map((h) => h.status);

      if (!osCheckin || !statusPermiteCheckin(osCheckin.status as never)) {
        throw new Error(mensagemCheckinBloqueado(osCheckin?.status as never));
      }

      if (checkinBloqueadoPorAprovacao(osCheckin as never, histStatuses)) {
        throw new Error(
          "Esta OS aguarda aprovação do cliente antes de iniciar o atendimento. Reagende após a aprovação."
        );
      }

      const extras: Record<string, string> = {};
      if (assumir || profile.papel === "tecnico") {
        extras.tecnico = nome;
        extras.tecnico_id = profile.id;
      }
      await transicionarStatusOs(supabase, {
        osId: ag.os_id,
        status: "em_execucao",
        observacao: "Check-in do técnico na visita",
        origem: "check-in",
        sistema: true,
        papel: profile.papel,
        extras,
      });
    } catch (err) {
      await supabase
        .from("agendamentos")
        .update({
          status: ag.status,
          checkin_at: null,
          checkin_por: null,
          checkin_lat: null,
          checkin_lng: null,
        })
        .eq("id", id);
      throw err;
    }
  }

  if (lat != null && lng != null) {
    await salvarPosicaoTecnico(supabase, profile, {
      lat,
      lng,
      precisao,
      emAtendimento: true,
      agendamentoId: id,
    });
  }

  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/ordens");
  if (ag.os_id) revalidatePath(`/ordens/${ag.os_id}`);
}

export async function checkoutAgendamento(id: string, formData?: FormData) {
  const profile = await requirePermissao("agenda_checkin");
  const supabase = await createClient();
  await validarAgendamentoTecnico(supabase, id, profile);

  const ag = await carregarAgendamento(supabase, id);
  validarCheckoutAgenda(ag);

  await garantirAtribuicaoCampo(supabase, profile, {
    agendamentoId: id,
    osId: ag.os_id,
  });

  const lat = coord(formData?.get("lat"));
  const lng = coord(formData?.get("lng"));
  const precisao = coord(formData?.get("precisao"));

  const checkoutUpdates: Record<string, string | number | null> = {
    checkout_at: new Date().toISOString(),
    status: "realizado",
    checkout_lat: lat,
    checkout_lng: lng,
  };

  if (ag.os_id) {
    const resultado = (String(formData?.get("resultado") || "visita") as CheckoutResultado);
    const visitaCobrada = formData?.get("visita_cobrada") === "on";

    const { data: os } = await supabase
      .from("ordens_servico")
      .select(
        "status, aprovado, tipo_atendimento, valor_visita, valor_itens, abater_visita, desconto, acrescimo, custo_total, cliente_id, numero, tecnico, tecnico_id, data_previsao, turno, valor_aprovado, clientes(nome)"
      )
      .eq("id", ag.os_id)
      .single();

    if (os) {
      let statusOs = os.status as string;

      if (statusOs !== "em_execucao") {
        if (["em_roteiro", "aprovada", "aguardando_peca"].includes(statusOs)) {
          await transicionarStatusOs(supabase, {
            osId: ag.os_id,
            status: "em_execucao",
            observacao: "Sincronizado automaticamente no check-out",
            origem: "check-out",
            sistema: true,
            papel: profile.papel,
          });
          statusOs = "em_execucao";
        } else {
          throw new Error(
            "A ordem não está em execução. Faça check-in na visita antes do check-out."
          );
        }
      }

      if (visitaCobrada && Number(os.valor_visita) > 0) {
        if (!os.abater_visita) {
          const novoTotal = calcValorTotalCliente(
            Number(os.valor_itens),
            Number(os.valor_visita),
            true,
            Number(os.desconto),
            Number(os.acrescimo)
          );
          const { error: updVisita } = await supabase
            .from("ordens_servico")
            .update({ abater_visita: true, valor_total: novoTotal })
            .eq("id", ag.os_id);
          assertSupabaseOk(updVisita, "Não foi possível registrar visita paga");

          if (os.aprovado) {
            await requererReaprovacaoSeValoresMudaram(
              supabase,
              ag.os_id,
              {
                aprovado: true,
                valor_aprovado: os.valor_aprovado,
                status: os.status as never,
                valor_itens: Number(os.valor_itens),
                valor_visita: Number(os.valor_visita),
                abater_visita: false,
                desconto: Number(os.desconto),
                acrescimo: Number(os.acrescimo),
              },
              novoTotal
            );
          }
        }

        const financeVisitaOk = await registrarReceitaVisitaCheckout(
          supabase,
          ag.os_id,
          Number(os.valor_visita),
          os.forma_pagamento
        );
        if (!financeVisitaOk) {
          throw new Error("Não foi possível registrar a visita paga no financeiro.");
        }
      } else if (
        !visitaCobrada &&
        Number(os.valor_visita) > 0 &&
        os.abater_visita &&
        Number(os.valor_itens) > 0
      ) {
        const novoTotal = calcValorTotalCliente(
          Number(os.valor_itens),
          Number(os.valor_visita),
          false,
          Number(os.desconto),
          Number(os.acrescimo)
        );
        const { error: updIncluir } = await supabase
          .from("ordens_servico")
          .update({ abater_visita: false, valor_total: novoTotal })
          .eq("id", ag.os_id);
        assertSupabaseOk(updIncluir, "Não foi possível atualizar valor da visita");
      }

      const { data: osAtual } = await supabase
        .from("ordens_servico")
        .select("status, aprovado, tipo_atendimento")
        .eq("id", ag.os_id)
        .single();

      const proximo = statusPosCheckout(
        {
          status: (osAtual?.status ?? os.status) as never,
          aprovado: Boolean(osAtual?.aprovado ?? os.aprovado),
          tipo_atendimento: osAtual?.tipo_atendimento ?? os.tipo_atendimento ?? "domicilio",
        },
        resultado
      );

      const obsCheckout =
        resultado === "visita"
          ? visitaCobrada
            ? "Check-out: visita/diagnóstico — visita paga (abatida do reparo)"
            : "Check-out: visita/diagnóstico — visita será cobrada junto no final"
          : resultado === "aguardando_peca"
            ? "Check-out: aguardando peça"
            : "Check-out: serviço executado nesta visita";

      if (proximo) {
        await transicionarStatusOs(supabase, {
          osId: ag.os_id,
          status: proximo,
          observacao: obsCheckout,
          origem: "check-out",
          sistema: true,
          papel: profile.papel,
        });

        if (proximo === "concluida" && os.aprovado) {
          const financeOk = await criarReceitaPendenteOs(supabase, ag.os_id);
          if (!financeOk) {
            throw new Error("Não foi possível registrar o saldo do serviço no financeiro.");
          }
        }
      }
    }
  }

  const { error: errAgenda } = await supabase.from("agendamentos").update(checkoutUpdates).eq("id", id);
  assertSupabaseOk(errAgenda, "Não foi possível finalizar a visita");

  if (ag.os_id) {
    const agendarRetorno = formData?.get("agendar_retorno") === "on";
    const retornoData = str(formData?.get("retorno_data"));
    const retornoTurno = str(formData?.get("retorno_turno")) || "manha";
    const resultadoCheckout = (String(formData?.get("resultado") || "visita") as CheckoutResultado);

    if (agendarRetorno && retornoData) {
      const { data: osRetorno } = await supabase
        .from("ordens_servico")
        .select(
          "tipo_atendimento, valor_visita, valor_itens, abater_visita, desconto, acrescimo, custo_total, cliente_id, numero, tecnico, tecnico_id, clientes(nome)"
        )
        .eq("id", ag.os_id)
        .single();

      if (osRetorno?.tipo_atendimento === "domicilio") {
        const tecnico_id = osRetorno.tecnico_id || profile.id;
        const tecnico = osRetorno.tecnico || nomeTecnico(profile);

        const { error: updPrev } = await supabase
          .from("ordens_servico")
          .update({ data_previsao: retornoData, turno: retornoTurno as never })
          .eq("id", ag.os_id);
        assertSupabaseOk(updPrev, "Não foi possível agendar retorno");

        await sincronizarAgendamentoOs(supabase, {
          osId: ag.os_id,
          clienteId: osRetorno.cliente_id,
          numero: osRetorno.numero,
          data: retornoData,
          turno: retornoTurno,
          tecnico,
          tecnico_id,
        });

        // @ts-expect-error relação
        const clienteNome = osRetorno.clientes?.nome as string | undefined;
        notificarWhatsAppClienteSugerido({
          osId: ag.os_id,
          numero: osRetorno.numero,
          clienteNome,
          evento: "retorno_agendado",
        }).catch(() => {});
      }
    } else if (
      !agendarRetorno &&
      (resultadoCheckout === "visita" || resultadoCheckout === "aguardando_peca")
    ) {
      const { data: osSemData } = await supabase
        .from("ordens_servico")
        .select("tipo_atendimento")
        .eq("id", ag.os_id)
        .single();

      if (osSemData?.tipo_atendimento === "domicilio") {
        const { error: limpaData } = await supabase
          .from("ordens_servico")
          .update({ data_previsao: null, turno: null })
          .eq("id", ag.os_id);
        assertSupabaseOk(limpaData, "Não foi possível limpar a data de retorno");

        await supabase
          .from("agendamentos")
          .update({ status: "cancelado" })
          .eq("os_id", ag.os_id)
          .in("status", ["agendado", "confirmado"]);
      }
    }
  }

  if (lat != null && lng != null) {
    await salvarPosicaoTecnico(supabase, profile, {
      lat,
      lng,
      precisao,
      emAtendimento: false,
      agendamentoId: null,
    });
  }

  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/financeiro");
  if (ag.os_id) revalidatePath(`/ordens/${ag.os_id}`);
}
