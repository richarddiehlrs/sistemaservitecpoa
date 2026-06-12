import type { createClient } from "@/lib/supabase/server";
import { horarioTurno } from "@/lib/turnos";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function sincronizarAgendamentoOs(
  supabase: Supabase,
  opts: {
    osId: string;
    clienteId: string;
    numero: number;
    data: string | null;
    turno: string | null;
    tecnico: string | null;
    tecnico_id: string | null;
  }
) {
  if (!opts.data || !opts.tecnico_id) return;

  const { data: cli } = await supabase
    .from("clientes")
    .select("nome, logradouro, numero, complemento, bairro, cidade, uf")
    .eq("id", opts.clienteId)
    .single();

  const endereco = cli
    ? [cli.logradouro, cli.numero, cli.complemento, cli.bairro, cli.cidade && `${cli.cidade}/${cli.uf ?? ""}`]
        .filter(Boolean)
        .join(", ")
    : null;

  const turno = opts.turno || "dia";
  const { inicio, fim } = horarioTurno(turno);
  const titulo = `Visita OS-${String(opts.numero).padStart(5, "0")}${cli?.nome ? ` - ${cli.nome}` : ""}`;

  const payload = {
    os_id: opts.osId,
    cliente_id: opts.clienteId,
    titulo,
    tipo: "visita" as const,
    turno: turno as "manha" | "tarde" | "dia",
    data: opts.data,
    hora_inicio: inicio,
    hora_fim: fim,
    tecnico: opts.tecnico,
    tecnico_id: opts.tecnico_id,
    endereco,
  };

  const { data: existente } = await supabase
    .from("agendamentos")
    .select("id, status")
    .eq("os_id", opts.osId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) {
    if (existente.status === "agendado" || existente.status === "confirmado") {
      const { error } = await supabase.from("agendamentos").update(payload).eq("id", existente.id);
      if (error) throw new Error(error.message);
      return existente.id;
    }

    if (["realizado", "cancelado", "em_atendimento"].includes(existente.status)) {
      const { data: novo, error } = await supabase
        .from("agendamentos")
        .insert({ ...payload, status: "agendado" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return novo?.id;
    }

    const { error } = await supabase
      .from("agendamentos")
      .update({
        tecnico: opts.tecnico,
        tecnico_id: opts.tecnico_id,
        endereco,
      })
      .eq("id", existente.id);
    if (error) throw new Error(error.message);
    return existente.id;
  }

  const { data: novo, error } = await supabase
    .from("agendamentos")
    .insert({ ...payload, status: "agendado" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return novo?.id;
}

export async function sincronizarAgendaStatusOs(
  supabase: Supabase,
  osId: string,
  statusOs: string
) {
  if (["concluida", "entregue", "cliente_ausente"].includes(statusOs)) {
    await supabase
      .from("agendamentos")
      .update({ status: "realizado" })
      .eq("os_id", osId)
      .in("status", ["agendado", "confirmado", "em_atendimento"]);
  }
  if (statusOs === "cancelada") {
    await supabase
      .from("agendamentos")
      .update({ status: "cancelado" })
      .eq("os_id", osId)
      .neq("status", "realizado");
  }
  if (statusOs === "em_execucao") {
    await supabase
      .from("agendamentos")
      .update({ status: "em_atendimento" })
      .eq("os_id", osId)
      .in("status", ["agendado", "confirmado"]);
  }
}
