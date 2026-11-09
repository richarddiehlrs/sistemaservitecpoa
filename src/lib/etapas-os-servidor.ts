import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StatusOS } from "@/types/database";
import { transicionarStatusOs } from "@/lib/transicao-os";
import { ETAPAS, efeitoEtapa, etapasDisponiveis, type EtapaOs, type LocalEquipamento } from "@/lib/etapas-os";

type Db = SupabaseClient<Database>;

/**
 * Registra uma etapa da OS: valida se faz sentido agora, muda status (com
 * histórico, agenda e financeiro via transicionarStatusOs), atualiza onde
 * está o aparelho e grava o marco na linha do tempo.
 */
export async function aplicarEtapaOs(
  supabase: Db,
  opts: {
    osId: string;
    etapa: EtapaOs;
    observacao?: string | null;
    previsao?: string | null;
    origem?: string;
    /** Check-out já validou o contexto (ex.: coleta logo após a visita). */
    ignorarValidacao?: boolean;
  }
): Promise<{ status: StatusOS; local: LocalEquipamento }> {
  const { data: os, error } = await supabase
    .from("ordens_servico")
    .select("id, status, aprovado, local_equipamento, tipo_atendimento")
    .eq("id", opts.osId)
    .single();
  if (error || !os) throw new Error("OS não encontrada.");

  const ctx = {
    status: os.status as StatusOS,
    aprovado: Boolean(os.aprovado),
    local: ((os as { local_equipamento?: string }).local_equipamento ?? "cliente") as LocalEquipamento,
    tipoAtendimento: os.tipo_atendimento,
  };

  if (!opts.ignorarValidacao && !etapasDisponiveis(ctx).includes(opts.etapa)) {
    throw new Error(`A etapa "${ETAPAS[opts.etapa].label}" não se aplica a esta OS agora.`);
  }

  const efeito = efeitoEtapa(opts.etapa, ctx);
  const label = ETAPAS[opts.etapa].label;
  const obs = opts.observacao?.trim() || null;

  if (efeito.status && efeito.status !== ctx.status) {
    await transicionarStatusOs(supabase, {
      osId: opts.osId,
      status: efeito.status,
      observacao: obs ? `${label} — ${obs}` : label,
      origem: opts.origem ?? "linha do tempo",
      sistema: true,
      // A mensagem da etapa é enviada pela prévia do WhatsApp; evita aviso duplicado
      skipNotificacao: false,
    });
  }

  const agora = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("ordens_servico")
    .update({
      ...(efeito.local ? { local_equipamento: efeito.local } : {}),
      etapa_atual: opts.etapa,
      etapa_em: agora,
    } as never)
    .eq("id", opts.osId);
  if (upErr) throw new Error(upErr.message);

  const { error: insErr } = await supabase.from("os_etapas" as never).insert({
    os_id: opts.osId,
    etapa: opts.etapa,
    observacao: obs,
    previsao: opts.previsao || null,
  } as never);
  if (insErr) throw new Error(insErr.message);

  return { status: (efeito.status ?? ctx.status) as StatusOS, local: (efeito.local ?? ctx.local) as LocalEquipamento };
}
