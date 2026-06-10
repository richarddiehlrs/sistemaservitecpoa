"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { nomeTecnico } from "@/lib/permissoes";
import { onlyDigits } from "@/lib/format";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { sincronizarAgendamentoOs, sincronizarAgendaStatusOs } from "@/lib/agenda-os";
import { notificarTecnicoNovaOs } from "@/lib/push";
import type { StatusOS } from "@/types/database";

type ItemInput = {
  tipo: "servico" | "peca";
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
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

async function resolverTecnico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  profile: Awaited<ReturnType<typeof requirePermissao>>
): Promise<{ tecnico_id: string; tecnico: string }> {
  if (profile.papel === "tecnico") {
    return { tecnico_id: profile.id, tecnico: nomeTecnico(profile) };
  }
  const tecnico_id = str(formData.get("tecnico_id"));
  if (!tecnico_id) throw new Error("Selecione o técnico responsável.");
  const { data: t } = await supabase
    .from("profiles")
    .select("id, nome, email, papel, ativo")
    .eq("id", tecnico_id)
    .single();
  if (!t || t.papel !== "tecnico" || !t.ativo) {
    throw new Error("Técnico inválido ou inativo. Cadastre em Usuários.");
  }
  return { tecnico_id: t.id, tecnico: nomeTecnico(t) };
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
  const custoItens = itens.reduce(
    (s, i) => s + Number(i.quantidade) * Number(i.custo_unitario || 0),
    0
  );
  const total = calcValorTotalCliente(valorItens, valorVisita, abaterVisita, desconto, acrescimo);
  return { valorItens, custoItens, total };
}

function lerItens(formData: FormData): ItemInput[] {
  return JSON.parse(String(formData.get("itens_json") || "[]")).filter(
    (i: ItemInput) => i.descricao && i.descricao.trim()
  );
}

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
    cpf_cnpj: str(formData.get("novo_cpf_cnpj")) ? onlyDigits(String(formData.get("novo_cpf_cnpj"))) : null,
    telefone: str(formData.get("novo_telefone")) ? onlyDigits(String(formData.get("novo_telefone"))) : null,
    email: str(formData.get("novo_email")),
    cep: str(formData.get("novo_cep")) ? onlyDigits(String(formData.get("novo_cep"))) : null,
    logradouro: str(formData.get("novo_logradouro")),
    numero: str(formData.get("novo_numero")),
    complemento: str(formData.get("novo_complemento")),
    bairro: str(formData.get("novo_bairro")),
    cidade: str(formData.get("novo_cidade")),
    uf: str(formData.get("novo_uf")),
  };

  const { data, error } = await supabase.from("clientes").insert(dados).select("id").single();
  if (error) throw new Error(error.message);
  return data!.id;
}

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
  const profile = await requirePermissao("ordens_criar");
  const supabase = await createClient();

  const clienteId = await resolverCliente(supabase, formData);
  const equipamentoId = await resolverEquipamento(supabase, formData, clienteId);

  const itens = lerItens(formData);
  const valorVisita = num(formData.get("valor_visita"));
  const abaterVisita = formData.get("abater_visita") === "on";
  const desconto = num(formData.get("desconto"));
  const acrescimo = num(formData.get("acrescimo"));
  const { valorItens, custoItens, total } = calcTotais(itens, valorVisita, abaterVisita, desconto, acrescimo);

  const status = (str(formData.get("status")) as StatusOS) || "aberta";
  const turno = str(formData.get("turno"));
  const dataVisita = str(formData.get("data_previsao"));
  const { tecnico_id, tecnico } = await resolverTecnico(supabase, formData, profile);

  if (!dataVisita) throw new Error("Informe a data da visita — ela entra automaticamente na agenda do técnico.");

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
      tecnico_id,
      tecnico,
      prioridade: (str(formData.get("prioridade")) as never) || "normal",
      data_previsao: dataVisita,
      turno: (turno as never),
      valor_visita: valorVisita,
      abater_visita: abaterVisita,
      desconto,
      acrescimo,
      valor_itens: valorItens,
      custo_total: custoItens,
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
        custo_unitario: Number(i.custo_unitario) || 0,
      }))
    );
    if (itensErr) throw new Error(itensErr.message);
  }

  await supabase.from("os_status_historico").insert({
    os_id: os!.id,
    status,
    observacao: "Ordem de serviço aberta",
  });

  await sincronizarAgendamentoOs(supabase, {
    osId: os!.id,
    clienteId,
    numero: os!.numero,
    data: dataVisita,
    turno: turno || "dia",
    tecnico,
    tecnico_id,
  });

  if (tecnico_id && profile.id !== tecnico_id) {
    const { data: cli } = await supabase.from("clientes").select("nome").eq("id", clienteId).single();
    notificarTecnicoNovaOs({
      tecnicoId: tecnico_id,
      osId: os!.id,
      numero: os!.numero,
      clienteNome: cli?.nome,
      dataVisita,
    }).catch(() => {});
  }

  revalidatePath("/ordens");
  revalidatePath("/agenda");
  revalidatePath("/campo");
  redirect(`/ordens/${os!.id}`);
}

export async function atualizarOrdem(id: string, formData: FormData) {
  const profile = await requirePermissao("ordens_editar");
  const supabase = await createClient();

  const itens = lerItens(formData);
  const valorVisita = num(formData.get("valor_visita"));
  const abaterVisita = formData.get("abater_visita") === "on";
  const desconto = num(formData.get("desconto"));
  const acrescimo = num(formData.get("acrescimo"));
  const { valorItens, custoItens, total } = calcTotais(itens, valorVisita, abaterVisita, desconto, acrescimo);
  const { tecnico_id, tecnico } = await resolverTecnico(supabase, formData, profile);
  const dataVisita = str(formData.get("data_previsao"));
  const turno = str(formData.get("turno"));

  if (!dataVisita) throw new Error("Informe a data da visita — ela entra automaticamente na agenda do técnico.");

  const { data: osAtual } = await supabase
    .from("ordens_servico")
    .select("numero, cliente_id, tecnico_id")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("ordens_servico")
    .update({
      defeito_relatado: str(formData.get("defeito_relatado")),
      diagnostico: str(formData.get("diagnostico")),
      servico_executado: str(formData.get("servico_executado")),
      acompanha: str(formData.get("acompanha")),
      estado_aparelho: str(formData.get("estado_aparelho")),
      tecnico_id,
      tecnico,
      prioridade: (str(formData.get("prioridade")) as never) || "normal",
      data_previsao: dataVisita,
      turno: (turno as never),
      valor_visita: valorVisita,
      abater_visita: abaterVisita,
      desconto,
      acrescimo,
      valor_itens: valorItens,
      custo_total: custoItens,
      valor_total: total,
      forma_pagamento: str(formData.get("forma_pagamento")),
      garantia_dias: Math.round(num(formData.get("garantia_dias"))) || 90,
      observacoes: str(formData.get("observacoes")),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (osAtual) {
    await sincronizarAgendamentoOs(supabase, {
      osId: id,
      clienteId: osAtual.cliente_id,
      numero: osAtual.numero,
      data: dataVisita,
      turno: turno || "dia",
      tecnico,
      tecnico_id,
    });

    if (tecnico_id && tecnico_id !== osAtual.tecnico_id) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", osAtual.cliente_id)
        .single();
      notificarTecnicoNovaOs({
        tecnicoId: tecnico_id,
        osId: id,
        numero: osAtual.numero,
        clienteNome: cli?.nome,
        dataVisita,
      }).catch(() => {});
    }
  }

  await supabase.from("os_itens").delete().eq("os_id", id);
  if (itens.length > 0) {
    await supabase.from("os_itens").insert(
      itens.map((i) => ({
        os_id: id,
        tipo: i.tipo,
        descricao: i.descricao,
        quantidade: Number(i.quantidade) || 1,
        valor_unitario: Number(i.valor_unitario) || 0,
        custo_unitario: Number(i.custo_unitario) || 0,
      }))
    );
  }

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/agenda");
  revalidatePath("/campo");
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

  await sincronizarAgendaStatusOs(supabase, id, status);

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/ordens");
  revalidatePath("/agenda");
  revalidatePath("/campo");
}

// Lança a OS no financeiro: receita (valor total) + custo (despesa) = lucro automático.
export async function lancarFinanceiro(id: string, formData: FormData) {
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, cliente_id, valor_itens, valor_visita, abater_visita, desconto, acrescimo, valor_total, custo_total, forma_pagamento"
    )
    .eq("id", id)
    .single();
  if (!os) throw new Error("OS não encontrada.");

  const valorReceita = calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );

  const status = String(formData.get("status_pagamento") || "pendente");
  const dataVencimento = str(formData.get("data_vencimento"));
  const formaPagamento = str(formData.get("forma_pagamento")) || os.forma_pagamento;
  const numeroFmt = `OS-${String(os.numero).padStart(5, "0")}`;
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ data: catReceita }, { data: catCusto }] = await Promise.all([
    supabase.from("categorias_financeiras").select("id").eq("nome", "Serviços de assistência técnica").limit(1).single(),
    supabase.from("categorias_financeiras").select("id").eq("nome", "Compra de peças").limit(1).single(),
  ]);

  const lancamentos: Record<string, unknown>[] = [
    {
      tipo: "receita",
      descricao: `Receita ${numeroFmt}`,
      categoria_id: catReceita?.id ?? null,
      os_id: os.id,
      cliente_id: os.cliente_id,
      valor: valorReceita,
      data_competencia: hoje,
      data_vencimento: dataVencimento || hoje,
      data_pagamento: status === "pago" ? hoje : null,
      status,
      forma_pagamento: formaPagamento,
    },
  ];

  if (valorReceita !== Number(os.valor_total)) {
    await supabase.from("ordens_servico").update({ valor_total: valorReceita }).eq("id", id);
  }

  // Custo da OS -> despesa (gera o lucro líquido automaticamente no financeiro/DRE)
  if (Number(os.custo_total) > 0) {
    lancamentos.push({
      tipo: "despesa",
      descricao: `Custo ${numeroFmt}`,
      categoria_id: catCusto?.id ?? null,
      os_id: os.id,
      cliente_id: os.cliente_id,
      valor: os.custo_total,
      data_competencia: hoje,
      data_vencimento: hoje,
      data_pagamento: status === "pago" ? hoje : null,
      status,
      forma_pagamento: formaPagamento,
    });
  }

  const { error } = await supabase.from("lancamentos_financeiros").insert(lancamentos);
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

export async function salvarAssinaturaTecnico(id: string, dataUrl: string) {
  const profile = await requirePermissao("ordens_editar");
  const supabase = await createClient();

  if (profile.papel === "tecnico") {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("tecnico_id, tecnico")
      .eq("id", id)
      .single();
    if (!os) throw new Error("Ordem não encontrada.");
    const nome = nomeTecnico(profile);
    const atribuido =
      os.tecnico_id === profile.id ||
      (os.tecnico?.toLowerCase().includes(nome.toLowerCase()) ?? false);
    if (!atribuido) throw new Error("Esta ordem não está atribuída a você.");
  }

  const { error } = await supabase
    .from("ordens_servico")
    .update({ assinatura_tecnico: dataUrl })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/ordens/${id}`);
  revalidatePath("/imprimir/os/" + id);
}

export async function registrarClienteAusente(id: string, formData: FormData) {
  const profile = await requirePermissao("ordens_editar");
  const supabase = await createClient();

  const observacao = str(formData.get("observacao"));
  const fotoUrl = str(formData.get("foto_url"));
  const fotoPath = str(formData.get("foto_path"));

  const { data: osAtual } = await supabase
    .from("ordens_servico")
    .select("assinatura_tecnico, tecnico_id")
    .eq("id", id)
    .single();
  if (!osAtual?.assinatura_tecnico) {
    throw new Error("O técnico deve assinar a ordem de serviço antes de registrar cliente ausente.");
  }
  if (profile.papel === "tecnico" && osAtual.tecnico_id && osAtual.tecnico_id !== profile.id) {
    throw new Error("Esta ordem não está atribuída a você.");
  }
  if (!fotoUrl) throw new Error("Foto comprobatória é obrigatória.");

  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("ordens_servico")
    .update({
      status: "cliente_ausente",
      observacao_cliente_ausente: observacao,
      cliente_ausente_registrado_at: agora,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("os_anexos").insert({
    os_id: id,
    url: fotoUrl,
    path: fotoPath || "",
    momento: "cliente_ausente",
    descricao: observacao || "Cliente ausente — foto comprobatória",
  });

  await supabase.from("os_status_historico").insert({
    os_id: id,
    status: "cliente_ausente",
    observacao: observacao || `Cliente ausente — registrado por ${nomeTecnico(profile)}`,
  });

  await sincronizarAgendaStatusOs(supabase, id, "cliente_ausente");

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/ordens");
  revalidatePath("/campo");
  revalidatePath("/agenda");
  revalidatePath("/imprimir/os/" + id);
}

export async function excluirOrdem(id: string) {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();

  await supabase.from("lancamentos_financeiros").delete().eq("os_id", id);
  await supabase.from("agendamentos").update({ os_id: null }).eq("os_id", id);

  const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/ordens");
  revalidatePath("/financeiro");
  revalidatePath("/agenda");
  redirect("/ordens");
}
