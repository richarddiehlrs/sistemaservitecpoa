"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { nomeTecnico } from "@/lib/permissoes";

function num(v: FormDataEntryValue | null): number {
  if (v == null) return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

export async function lancarDespesaCampo(formData: FormData) {
  const profile = await requirePermissao("despesas_campo");
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
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

  const { error } = await supabase.from("lancamentos_financeiros").insert({
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
  });

  if (error) throw new Error(error.message);

  revalidatePath("/campo");
  revalidatePath("/financeiro");
}

function coord(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function registrarPosicaoTecnico(formData: FormData) {
  const profile = await requirePermissao("despesas_campo");
  const lat = coord(formData.get("lat"));
  const lng = coord(formData.get("lng"));
  if (lat == null || lng == null) throw new Error("Coordenadas inválidas.");

  const supabase = await createClient();
  const { error } = await supabase.from("posicoes_tecnico").upsert({
    user_id: profile.id,
    tecnico_nome: nomeTecnico(profile),
    lat,
    lng,
    precisao: coord(formData.get("precisao")),
    em_atendimento: formData.get("em_atendimento") === "1",
    agendamento_id: str(formData.get("agendamento_id")),
    atualizado_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/campo");
  revalidatePath("/agenda");
}
