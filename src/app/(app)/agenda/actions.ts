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

export async function criarAgendamento(formData: FormData) {
  await requirePermissao("agenda_criar");
  const supabase = await createClient();

  const turno = str(formData.get("turno"));
  const horas = horarioTurno(turno);

  const { error } = await supabase.from("agendamentos").insert({
    titulo: String(formData.get("titulo") || "").trim() || "Atendimento",
    tipo: (str(formData.get("tipo")) as never) || "visita",
    turno: (turno as never),
    data: str(formData.get("data")) || new Date().toISOString().slice(0, 10),
    hora_inicio: str(formData.get("hora_inicio")) || horas.inicio,
    hora_fim: str(formData.get("hora_fim")) || horas.fim,
    tecnico: str(formData.get("tecnico")),
    endereco: str(formData.get("endereco")),
    cliente_id: str(formData.get("cliente_id")),
    os_id: str(formData.get("os_id")),
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
  const { data: ag } = await supabase.from("agendamentos").select("tecnico").eq("id", id).single();
  if (!ag) throw new Error("Agendamento não encontrado.");
  if (profile.papel === "tecnico") {
    const nome = nomeTecnico(profile);
    const atribuido = ag.tecnico?.trim();
    if (atribuido && !atribuido.toLowerCase().includes(nome.toLowerCase())) {
      throw new Error("Este atendimento não está atribuído a você.");
    }
  }
}

export async function checkinAgendamento(id: string) {
  const profile = await requirePermissao("agenda_checkin");
  const supabase = await createClient();
  await validarAgendamentoTecnico(supabase, id, profile);

  const { data: ag } = await supabase
    .from("agendamentos")
    .select("tecnico, os_id")
    .eq("id", id)
    .single();
  if (!ag) throw new Error("Agendamento não encontrado.");

  const nome = nomeTecnico(profile);
  const assumir = !ag.tecnico?.trim();
  const updates: Record<string, string> = {
    checkin_at: new Date().toISOString(),
    checkin_por: profile.id,
    status: "em_atendimento",
  };
  if (assumir) updates.tecnico = nome;

  const { error } = await supabase.from("agendamentos").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  if (assumir && ag.os_id) {
    await supabase
      .from("ordens_servico")
      .update({ tecnico: nome, status: "em_execucao" })
      .eq("id", ag.os_id);
  }

  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/ordens");
}

export async function checkoutAgendamento(id: string) {
  const profile = await requirePermissao("agenda_checkin");
  const supabase = await createClient();
  await validarAgendamentoTecnico(supabase, id, profile);

  const { error } = await supabase
    .from("agendamentos")
    .update({
      checkout_at: new Date().toISOString(),
      status: "realizado",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
  revalidatePath("/campo");
}
