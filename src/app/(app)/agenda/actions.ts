"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { nomeTecnico } from "@/lib/permissoes";
import { horarioTurno } from "@/lib/turnos";

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
    const osUpdate: Record<string, string> = { status: "em_execucao" };
    if (assumir || profile.papel === "tecnico") {
      osUpdate.tecnico = nome;
      osUpdate.tecnico_id = profile.id;
    }
    await supabase.from("ordens_servico").update(osUpdate).eq("id", ag.os_id);
  }

  if (lat != null && lng != null) {
    await salvarPosicaoTecnico(supabase, profile, lat, lng, precisao, true, id);
  }

  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/ordens");
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

  const { error } = await supabase.from("agendamentos").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  if (lat != null && lng != null) {
    await salvarPosicaoTecnico(supabase, profile, lat, lng, precisao, false, null);
  }

  revalidatePath("/agenda");
  revalidatePath("/campo");
}
