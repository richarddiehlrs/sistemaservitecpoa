"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { nomeTecnico } from "@/lib/permissoes";
import { horarioTurno } from "@/lib/turnos";
import { transicionarStatusOs } from "@/lib/transicao-os";
import { statusPosCheckout, statusPermiteCheckin, type CheckoutResultado } from "@/lib/transicao-status";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { sincronizarFinanceiroOs } from "@/lib/os-financeiro";
import { sincronizarAgendamentoOs } from "@/lib/agenda-os";

function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

function coord(v: FormDataEntryValue | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function salvarPosicaoTecnico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Awaited<ReturnType<typeof requirePermissao>>,
  lat: number,
  lng: number,
  precisao: number | null,
  emAtendimento: boolean,
  agendamentoId: string | null
) {
  const nome = nomeTecnico(profile);
  await supabase.from("posicoes_tecnico").upsert({
    user_id: profile.id,
    tecnico_nome: nome,
    lat,
    lng,
    precisao,
    em_atendimento: emAtendimento,
    agendamento_id: agendamentoId,
    atualizado_at: new Date().toISOString(),
  });
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

  const { error } = await supabase.from("agendamentos").insert({
    titulo: String(formData.get("titulo") || "").trim() || "Atendimento",
    tipo: (str(formData.get("tipo")) as never) || "visita",
    turno: (turno as never),
    data: str(formData.get("data")) || new Date().toISOString().slice(0, 10),
    hora_inicio: str(formData.get("hora_inicio")) || horas.inicio,
    hora_fim: str(formData.get("hora_fim")) || horas.fim,
    tecnico,
    tecnico_id,
    endereco: str(formData.get("endereco")),
    cliente_id: str(formData.get("cliente_id")),
    os_id: osId,
    status: (str(formData.get("status")) as never) || "agendado",
    observacoes: str(formData.get("observacoes")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
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

  const lat = coord(formData?.get("lat"));
  const lng = coord(formData?.get("lng"));
  const precisao = coord(formData?.get("precisao"));

  const { data: ag } = await supabase
    .from("agendamentos")
    .select("tecnico, tecnico_id, os_id")
    .eq("id", id)
    .single();
  if (!ag) throw new Error("Agendamento não encontrado.");

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

  const { error } = await supabase.from("agendamentos").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  if (ag.os_id) {
    const { data: osCheckin } = await supabase
      .from("ordens_servico")
      .select("status")
      .eq("id", ag.os_id)
      .single();

    if (!osCheckin || !statusPermiteCheckin(osCheckin.status as never)) {
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
  }

  if (lat != null && lng != null) {
    await salvarPosicaoTecnico(supabase, profile, lat, lng, precisao, true, id);
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

  const lat = coord(formData?.get("lat"));
  const lng = coord(formData?.get("lng"));
  const precisao = coord(formData?.get("precisao"));

  const updates: Record<string, string | number | null> = {
    checkout_at: new Date().toISOString(),
    status: "realizado",
    checkout_lat: lat,
    checkout_lng: lng,
  };

  const { data: ag } = await supabase
    .from("agendamentos")
    .select("os_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("agendamentos").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  if (ag?.os_id) {
    const resultado = (String(formData?.get("resultado") || "visita") as CheckoutResultado);
    const visitaCobrada = formData?.get("visita_cobrada") === "on";

    const { data: os } = await supabase
      .from("ordens_servico")
      .select(
        "status, aprovado, tipo_atendimento, valor_visita, valor_itens, abater_visita, desconto, acrescimo, custo_total, cliente_id, numero, tecnico, tecnico_id, data_previsao, turno"
      )
      .eq("id", ag.os_id)
      .single();

    if (os) {
      if (visitaCobrada && Number(os.valor_visita) > 0 && !os.abater_visita) {
        const novoTotal = calcValorTotalCliente(
          Number(os.valor_itens),
          Number(os.valor_visita),
          true,
          Number(os.desconto),
          Number(os.acrescimo)
        );
        await supabase
          .from("ordens_servico")
          .update({ abater_visita: true, valor_total: novoTotal })
          .eq("id", ag.os_id);

        if (os.aprovado) {
          await sincronizarFinanceiroOs(
            supabase,
            ag.os_id,
            novoTotal,
            Number(os.custo_total) || 0
          );
        }
      }

      const proximo = statusPosCheckout(
        {
          status: os.status as never,
          aprovado: Boolean(os.aprovado),
          tipo_atendimento: os.tipo_atendimento ?? "domicilio",
        },
        resultado
      );

      const obsCheckout =
        resultado === "visita"
          ? "Check-out: visita/diagnóstico — retorno pode ser necessário"
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
      }

      const agendarRetorno = formData?.get("agendar_retorno") === "on";
      const retornoData = str(formData?.get("retorno_data"));
      const retornoTurno = str(formData?.get("retorno_turno")) || "manha";

      if (
        agendarRetorno &&
        retornoData &&
        os.tipo_atendimento === "domicilio"
      ) {
        const tecnico_id = os.tecnico_id || profile.id;
        const tecnico = os.tecnico || nomeTecnico(profile);

        await supabase
          .from("ordens_servico")
          .update({ data_previsao: retornoData, turno: retornoTurno as never })
          .eq("id", ag.os_id);

        await sincronizarAgendamentoOs(supabase, {
          osId: ag.os_id,
          clienteId: os.cliente_id,
          numero: os.numero,
          data: retornoData,
          turno: retornoTurno,
          tecnico,
          tecnico_id,
        });
      }
    }
  }

  if (lat != null && lng != null) {
    await salvarPosicaoTecnico(supabase, profile, lat, lng, precisao, false, null);
  }

  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/financeiro");
  if (ag?.os_id) revalidatePath(`/ordens/${ag.os_id}`);
}
