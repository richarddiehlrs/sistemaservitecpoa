"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { horarioTurno } from "@/lib/turnos";

function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

export async function criarAgendamento(formData: FormData) {
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("agendamentos")
    .update({ status: status as never })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}

export async function excluirAgendamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
}
