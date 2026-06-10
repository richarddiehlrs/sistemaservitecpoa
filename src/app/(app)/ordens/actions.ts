"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/format";
import type { StatusOS } from "@/types/database";

type ItemInput = {
  tipo: "servico" | "peca";
  descricao: string;
  quantidade: number;
  valor_unitario: number;
};

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

function calcTotais(
  itens: ItemInput[],
  valorVisita: number,
  abaterVisita: boolean,
  desconto: number,
  acrescimo: number
) {
  const valorItens = itens.reduce(
    (s, i) => s + Number(i.quantidade) * Number(i.valor_unitario),
    0
  );
  let total = valorItens + acrescimo - desconto - (abaterVisita ? valorVisita : 0);
  if (total < 0) total = 0;
  return { valorItens, total };
}

// Resolve cliente: usa o existente OU grava um novo a partir dos dados da OS.
async function resolverCliente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
): Promise<string> {
  const clienteId = str(formData.get("cliente_id"));
  if (clienteId) return clienteId;

  const nome = str(formData.get("novo_nome"));
  if (!nome) throw new Error("Selecione um cliente ou informe o nome do novo cliente.");

  const dados = {
    nome,
    tipo: "PF" as const,
    cpf_cnpj: str(formData.get("novo_cpf_cnpj"))
      ? onlyDigits(String(formData.get("novo_cpf_cnpj")))
      : null,
    telefone: str(formData.get("novo_telefone"))
      ? onlyDigits(String(formData.get("novo_telefone")))
      : null,
    email: str(formData.get("novo_email")),
    cep: str(formData.get("novo_cep")) ? onlyDigits(String(formData.get("novo_cep"))) : null,
    logradouro: str(formData.get("novo_logradouro")),
    numero: str(formData.get("novo_numero")),
    complemento: str(formData.get("novo_complemento")),
    bairro: str(formData.get("novo_bairro")),
    cidade: str(formData.get("novo_cidade")),
    uf: str(formData.get("novo_uf")),
  };

  const { data, error } = await supabase
    .from("clientes")
    .insert(dados)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id;
}

// Resolve equipamento: usa existente OU cria a partir dos dados informados.
async function resolverEquipamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  clienteId: string
): Promise<string | null> {
  const equipamentoId = str(formData.get("equipamento_id"));
  if (equipamentoId) return equipamentoId;

  const tipo = str(formData.get("equip_tipo"));
  if (!tipo) return null;

  const { data, error } = await supabase
    .from("equipamentos")
    .insert({
      cliente_id: clienteId,
      tipo,
      marca: str(formData.get("equip_marca")),
      modelo: str(formData.get("equip_modelo")),
      numero_serie: str(formData.get("equip_serie")),
      voltagem: str(formData.get("equip_voltagem")),
      cor: str(formData.get("equip_cor")),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id;
}

export async function criarOrdem(formData: FormData) {
  const supabase = await createClient();

  const clienteId = await resolverCliente(supabase, formData);
  const equipamentoId = await resolverEquipamento(supabase, formData, clienteId);

  const itens: ItemInput[] = JSON.parse(
    String(formData.get("itens_json") || "[]")
  ).filter((i: ItemInput) => i.descricao && i.descricao.trim());

  const valorVisita = num(formData.get("valor_visita"));
  const abaterVisita = formData.get("abater_visita") === "on";
  const desconto = num(formData.get("desconto"));
  const acrescimo = num(formData.get("acrescimo"));
  const { valorItens, total } = calcTotais(
    itens,
    valorVisita,
    abaterVisita,
    desconto,
    acrescimo
  );

  const status = (str(formData.get("status")) as StatusOS) || "aberta";

  const { data: os, error } = await supabase
    .from("ordens_servico")
    .insert({
      cliente_id: clienteId,
      equipamento_id: equipamentoId,
      status,
      defeito_relatado: str(formData.get("defeito_relatado")),
      diagnostico: str(formData.get("diagnostico")),
      servico_executado: str(formData.get("servico_executado")),
      acompanha: str(formData.get("acompanha")),
      estado_aparelho: str(formData.get("estado_aparelho")),
      tecnico: str(formData.get("tecnico")),
      prioridade: (str(formData.get("prioridade")) as never) || "normal",
      data_previsao: str(formData.get("data_previsao")),
      valor_visita: valorVisita,
      abater_visita: abaterVisita,
      desconto,
      acrescimo,
      valor_itens: valorItens,
      valor_total: total,
      forma_pagamento: str(formData.get("forma_pagamento")),
      garantia_dias: Math.round(num(formData.get("garantia_dias"))) || 90,
      observacoes: str(formData.get("observacoes")),
    })
    .select("id, numero")
    .single();

  if (error) throw new Error(error.message);

  if (itens.length > 0) {
    const { error: itensErr } = await supabase.from("os_itens").insert(
      itens.map((i) => ({
        os_id: os!.id,
        tipo: i.tipo,
        descricao: i.descricao,
        quantidade: Number(i.quantidade) || 1,
        valor_unitario: Number(i.valor_unitario) || 0,
      }))
    );
    if (itensErr) throw new Error(itensErr.message);
  }

  await supabase.from("os_status_historico").insert({
    os_id: os!.id,
    status,
    observacao: "Ordem de serviço aberta",
  });

  revalidatePath("/ordens");
  redirect(`/ordens/${os!.id}`);
}

export async function atualizarOrdem(id: string, formData: FormData) {
  const supabase = await createClient();

  const itens: ItemInput[] = JSON.parse(
    String(formData.get("itens_json") || "[]")
  ).filter((i: ItemInput) => i.descricao && i.descricao.trim());

  const valorVisita = num(formData.get("valor_visita"));
  const abaterVisita = formData.get("abater_visita") === "on";
  const desconto = num(formData.get("desconto"));
  const acrescimo = num(formData.get("acrescimo"));
  const { valorItens, total } = calcTotais(
    itens,
    valorVisita,
    abaterVisita,
    desconto,
    acrescimo
  );

  const { error } = await supabase
    .from("ordens_servico")
    .update({
      defeito_relatado: str(formData.get("defeito_relatado")),
      diagnostico: str(formData.get("diagnostico")),
      servico_executado: str(formData.get("servico_executado")),
      acompanha: str(formData.get("acompanha")),
      estado_aparelho: str(formData.get("estado_aparelho")),
      tecnico: str(formData.get("tecnico")),
      prioridade: (str(formData.get("prioridade")) as never) || "normal",
      data_previsao: str(formData.get("data_previsao")),
      valor_visita: valorVisita,
      abater_visita: abaterVisita,
      desconto,
      acrescimo,
      valor_itens: valorItens,
      valor_total: total,
      forma_pagamento: str(formData.get("forma_pagamento")),
      garantia_dias: Math.round(num(formData.get("garantia_dias"))) || 90,
      observacoes: str(formData.get("observacoes")),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Regrava itens (estratégia simples: apaga e insere novamente)
  await supabase.from("os_itens").delete().eq("os_id", id);
  if (itens.length > 0) {
    await supabase.from("os_itens").insert(
      itens.map((i) => ({
        os_id: id,
        tipo: i.tipo,
        descricao: i.descricao,
        quantidade: Number(i.quantidade) || 1,
        valor_unitario: Number(i.valor_unitario) || 0,
      }))
    );
  }

  revalidatePath(`/ordens/${id}`);
  redirect(`/ordens/${id}`);
}

export async function alterarStatusForm(id: string, formData: FormData) {
  const status = String(formData.get("status") || "aberta") as StatusOS;
  const observacao = str(formData.get("observacao")) || undefined;
  await alterarStatus(id, status, observacao);
}

export async function alterarStatus(id: string, status: StatusOS, observacao?: string) {
  const supabase = await createClient();

  const update: Record<string, unknown> = { status };
  if (status === "concluida") update.data_conclusao = new Date().toISOString();
  if (status === "entregue") update.data_entrega = new Date().toISOString();

  const { error } = await supabase.from("ordens_servico").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("os_status_historico").insert({
    os_id: id,
    status,
    observacao: observacao || null,
  });

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/ordens");
}

// Lança a receita da OS no financeiro (contas a receber).
export async function lancarFinanceiro(id: string, formData: FormData) {
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, numero, cliente_id, valor_total, forma_pagamento")
    .eq("id", id)
    .single();
  if (!os) throw new Error("OS não encontrada.");

  const status = String(formData.get("status_pagamento") || "pendente");
  const dataVencimento = str(formData.get("data_vencimento"));
  const formaPagamento = str(formData.get("forma_pagamento")) || os.forma_pagamento;

  const { data: cat } = await supabase
    .from("categorias_financeiras")
    .select("id")
    .eq("nome", "Serviços de assistência técnica")
    .limit(1)
    .single();

  const hoje = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("lancamentos_financeiros").insert({
    tipo: "receita",
    descricao: `Receita OS-${String(os.numero).padStart(5, "0")}`,
    categoria_id: cat?.id ?? null,
    os_id: os.id,
    cliente_id: os.cliente_id,
    valor: os.valor_total,
    data_competencia: hoje,
    data_vencimento: dataVencimento || hoje,
    data_pagamento: status === "pago" ? hoje : null,
    status,
    forma_pagamento: formaPagamento,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/financeiro");
  redirect(`/ordens/${id}`);
}

export async function salvarAssinatura(id: string, dataUrl: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ordens_servico")
    .update({ assinatura_cliente: dataUrl })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/ordens/${id}`);
}

export async function excluirOrdem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ordens");
  redirect("/ordens");
}
