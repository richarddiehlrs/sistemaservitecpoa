"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { assertOsAtribuida } from "@/lib/os-acesso";
import { salvarPosicaoTecnico } from "@/lib/posicao-tecnico";
import { nomeTecnico } from "@/lib/permissoes";
import { notificarDespesaCampo } from "@/lib/notificacoes";
import { hojeYmdLocal, parseNumForm } from "@/lib/format";
import { safeAction, type ActionResult } from "@/lib/action-result";

function num(v: FormDataEntryValue | null): number {
  return parseNumForm(v);
}

function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

async function lancarDespesaCampoImpl(formData: FormData) {
  const profile = await requirePermissao("despesas_campo");
  const supabase = await createClient();
  const hoje = hojeYmdLocal();
  const tecnico = nomeTecnico(profile);

  const tipo = String(formData.get("tipo_despesa") || "outro");
  const valor = num(formData.get("valor"));
  if (valor <= 0) throw new Error("Informe um valor maior que zero.");

  const descricaoMap: Record<string, string> = {
    combustivel: "Combustível",
    alimentacao: "Alimentação / refeição",
    estacionamento: "Estacionamento / pedágio",
    ferramenta: "Ferramentas / material",
    outro: "Despesa de campo",
  };
  const descBase = descricaoMap[tipo] || "Despesa de campo";
  const obs = str(formData.get("observacoes"));
  const osId = str(formData.get("os_id"));
  const descricao = obs ? `${descBase} — ${obs}` : descBase;

  if (osId) {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("tecnico_id, tecnico")
      .eq("id", osId)
      .maybeSingle();
    if (!os) throw new Error("Ordem de serviço não encontrada.");
    assertOsAtribuida(profile, os);
  }

  const catNome =
    tipo === "combustivel" ? "Combustível"
    : tipo === "alimentacao" ? "Alimentação / refeição"
    : "Despesas de campo (técnico)";

  const { data: cat } = await supabase
    .from("categorias_financeiras")
    .select("id")
    .eq("nome", catNome)
    .limit(1)
    .maybeSingle();

  const { data: lanc, error } = await supabase
    .from("lancamentos_financeiros")
    .insert({
      tipo: "despesa",
      descricao,
      categoria_id: cat?.id ?? null,
      os_id: osId,
      tecnico,
      criado_por: profile.id,
      origem: "campo",
      valor,
      valor_pago: 0,
      data_competencia: hoje,
      data_vencimento: hoje,
      status: "pendente",
      observacoes: obs,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  notificarDespesaCampo({
    lancamentoId: lanc?.id,
    valor,
    descricao,
    tecnicoNome: tecnico,
  }).catch(() => {});

  revalidatePath("/campo");
  revalidatePath("/financeiro");
}

function coord(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function registrarPosicaoTecnicoImpl(formData: FormData) {
  const profile = await requirePermissao("despesas_campo");
  const lat = coord(formData.get("lat"));
  const lng = coord(formData.get("lng"));
  if (lat == null || lng == null) throw new Error("Coordenadas inválidas.");

  const supabase = await createClient();
  await salvarPosicaoTecnico(supabase, profile, {
    lat,
    lng,
    precisao: coord(formData.get("precisao")),
    emAtendimento: formData.get("em_atendimento") === "1",
    agendamentoId: str(formData.get("agendamento_id")),
  });

  revalidatePath("/campo");
  revalidatePath("/agenda");
}

// ===================== Wrappers seguros (ActionResult) =====================

export async function lancarDespesaCampo(formData: FormData): Promise<ActionResult> {
  return safeAction(() => lancarDespesaCampoImpl(formData));
}

export async function registrarPosicaoTecnico(
  formData: FormData
): Promise<ActionResult> {
  return safeAction(() => registrarPosicaoTecnicoImpl(formData));
}
