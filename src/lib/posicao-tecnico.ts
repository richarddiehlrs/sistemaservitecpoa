import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { nomeTecnico } from "@/lib/permissoes";

type Db = SupabaseClient<Database>;

export async function salvarPosicaoTecnico(
  supabase: Db,
  profile: { id: string; nome?: string | null; email?: string | null },
  opts: {
    lat: number;
    lng: number;
    precisao?: number | null;
    emAtendimento: boolean;
    agendamentoId?: string | null;
  }
) {
  await supabase.from("posicoes_tecnico").upsert({
    user_id: profile.id,
    tecnico_nome: nomeTecnico(profile),
    lat: opts.lat,
    lng: opts.lng,
    precisao: opts.precisao ?? null,
    em_atendimento: opts.emAtendimento,
    agendamento_id: opts.agendamentoId ?? null,
    atualizado_at: new Date().toISOString(),
  });
}
