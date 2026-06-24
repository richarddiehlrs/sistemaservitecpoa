"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { assertOsAtribuida } from "@/lib/os-acesso";
import { nomeTecnico } from "@/lib/permissoes";
import { onlyDigits, hojeYmdLocal, parseNumForm } from "@/lib/format";
import { calcReceitaFaturamentoOs, calcValorTotalCliente } from "@/lib/os-valores";
import {
  resolverEquipamentosOs,
  salvarVinculosEquipamentosOs,
} from "@/lib/os-equipamentos";
import { executarAprovacaoOs, requererReaprovacaoSeValoresMudaram } from "@/lib/aprovacao-os";
import {
  calcTotaisOs,
  deveEnviarAguardandoAprovacao,
  resolverAbaterVisita,
} from "@/lib/orcamento-os";
import {
  sincronizarFinanceiroOs,
  temLancamentoAtivoOs,
} from "@/lib/os-financeiro";
import { transicionarStatusOs } from "@/lib/transicao-os";
import { STATUS_OS_BLOQUEADO_EDICAO, validarTransicaoStatus } from "@/lib/transicao-status";
import { sincronizarAgendamentoOs } from "@/lib/agenda-os";
import { limparDadosVinculadosOs } from "@/lib/limpar-os";
import {
  notificarOsNova,
  notificarClienteAusente,
} from "@/lib/notificacoes";
import type { StatusOS, TipoAtendimento } from "@/types/database";
import { podeAbrirRetornoGarantia } from "@/lib/os-garantia";

function lerTipoAtendimento(formData: FormData): TipoAtendimento {
  const t = str(formData.get("tipo_atendimento"));
  return t === "oficina" ? "oficina" : "domicilio";
}

async function resolverTecnicoParaOs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  profile: Awaited<ReturnType<typeof requirePermissao>>,
  tipo: TipoAtendimento
): Promise<{ tecnico_id: string | null; tecnico: string | null }> {
  if (tipo === "oficina") {
    const tecnico_id = str(formData.get("tecnico_id"));
    if (!tecnico_id) return { tecnico_id: null, tecnico: null };
    const { data: t } = await supabase
      .from("profiles")
      .select("id, nome, email, papel, ativo")
      .eq("id", tecnico_id)
      .single();
    if (!t || t.papel !== "tecnico" || !t.ativo) {
      throw new Error("Técnico inválido ou inativo.");
    }
    return { tecnico_id: t.id, tecnico: nomeTecnico(t) };
  }
  return resolverTecnico(supabase, formData, profile);
}

type ItemInput = {
  tipo: "servico" | "peca";
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
};

function num(v: FormDataEntryValue | null): number {
  return parseNumForm(v);
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
  return calcTotaisOs(itens, valorVisita, abaterVisita, desconto, acrescimo);
}

function lerItens(formData: FormData): ItemInput[] {
  try {
    return JSON.parse(String(formData.get("itens_json") || "[]")).filter(
      (i: ItemInput) => i.descricao && i.descricao.trim()
    );
  } catch {
    throw new Error("Lista de itens inválida. Recarregue a página e tente novamente.");
  }
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

export async function criarOrdem(formData: FormData) {
  const profile = await requirePermissao("ordens_criar");
  const supabase = await createClient();

  const clienteId = await resolverCliente(supabase, formData);
  const equipamentoIds = await resolverEquipamentosOs(
    supabase,
    clienteId,
    str(formData.get("equipamentos_json"))
  );
  const equipamentoId = equipamentoIds[0] ?? null;

  const itens = lerItens(formData);
  const tipo = lerTipoAtendimento(formData);
  const valorVisita = tipo === "domicilio" ? num(formData.get("valor_visita")) : 0;
  const valorItensPrev = itens.reduce(
    (s, i) => s + Number(i.quantidade) * Number(i.valor_unitario),
    0
  );
  const abaterVisita = resolverAbaterVisita(tipo, formData, valorItensPrev);
  const desconto = num(formData.get("desconto"));
  const acrescimo = num(formData.get("acrescimo"));
  const { valorItens, custoItens, total } = calcTotais(itens, valorVisita, abaterVisita, desconto, acrescimo);

  const status = (str(formData.get("status")) as StatusOS) || (tipo === "oficina" ? "em_analise" : "em_roteiro");
  const turno = str(formData.get("turno"));
  const dataVisita = str(formData.get("data_previsao"));
  const { tecnico_id, tecnico } = await resolverTecnicoParaOs(supabase, formData, profile, tipo);

  if (tipo === "domicilio" && !dataVisita) {
    throw new Error("Informe a data da visita — ela entra automaticamente na agenda do técnico.");
  }

  const { data: os, error } = await supabase
    .from("ordens_servico")
    .insert({
      cliente_id: clienteId,
      equipamento_id: equipamentoId,
      tipo_atendimento: tipo,
      status,
      defeito_relatado: str(formData.get("defeito_relatado")),
      diagnostico: str(formData.get("diagnostico")),
      servico_executado: str(formData.get("servico_executado")),
      acompanha: str(formData.get("acompanha")),
      estado_aparelho: str(formData.get("estado_aparelho")),
      tecnico_id,
      tecnico,
      prioridade: (str(formData.get("prioridade")) as never) || "normal",
      data_previsao: tipo === "domicilio" ? dataVisita : null,
      turno: tipo === "domicilio" ? (turno as never) : null,
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

  await salvarVinculosEquipamentosOs(supabase, os!.id, equipamentoIds);

  await supabase.from("os_status_historico").insert({
    os_id: os!.id,
    status: "aberta",
    observacao: "Ordem de serviço aberta",
  });

  if (tipo === "domicilio" && dataVisita && tecnico_id) {
    await sincronizarAgendamentoOs(supabase, {
      osId: os!.id,
      clienteId,
      numero: os!.numero,
      data: dataVisita,
      turno: turno || "dia",
      tecnico,
      tecnico_id,
    });
  }

  if (tecnico_id && profile.id !== tecnico_id) {
    const { data: cli } = await supabase.from("clientes").select("nome").eq("id", clienteId).single();
    notificarOsNova({
      tecnicoId: tecnico_id,
      osId: os!.id,
      numero: os!.numero,
      clienteNome: cli?.nome,
      dataVisita: tipo === "domicilio" ? dataVisita : null,
    }).catch(() => {});
  }

  revalidatePath("/ordens");
  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/painel");
  if (tipo === "oficina") {
    redirect(`/ordens/${os!.id}?etiqueta=1`);
  }
  redirect(`/ordens/${os!.id}`);
}

export async function atualizarOrdem(id: string, formData: FormData) {
  const profile = await requirePermissao("ordens_editar");
  const supabase = await createClient();

  const itens = lerItens(formData);
  const tipo = lerTipoAtendimento(formData);
  const valorVisita = tipo === "domicilio" ? num(formData.get("valor_visita")) : 0;
  const valorItensPrev = itens.reduce(
    (s, i) => s + Number(i.quantidade) * Number(i.valor_unitario),
    0
  );
  const abaterVisita = resolverAbaterVisita(tipo, formData, valorItensPrev);
  const desconto = num(formData.get("desconto"));
  const acrescimo = num(formData.get("acrescimo"));
  const { valorItens, custoItens, total } = calcTotais(itens, valorVisita, abaterVisita, desconto, acrescimo);
  const { tecnico_id, tecnico } = await resolverTecnicoParaOs(supabase, formData, profile, tipo);
  const dataVisita = str(formData.get("data_previsao"));
  const turno = str(formData.get("turno"));

  if (tipo === "domicilio" && !dataVisita) {
    throw new Error("Informe a data da visita — ela entra automaticamente na agenda do técnico.");
  }

  const { data: osAtual } = await supabase
    .from("ordens_servico")
    .select(
      "numero, cliente_id, tecnico_id, tecnico, status, aprovado, valor_aprovado, valor_itens, valor_visita, abater_visita, desconto, acrescimo"
    )
    .eq("id", id)
    .single();

  if (
    osAtual &&
    STATUS_OS_BLOQUEADO_EDICAO.includes(osAtual.status as never) &&
    profile.papel !== "admin"
  ) {
    throw new Error(
      "Esta ordem está finalizada e não pode ser editada. Solicite ao administrador se precisar alterar."
    );
  }

  if (osAtual) {
    assertOsAtribuida(profile, osAtual);
  }

  const { error } = await supabase
    .from("ordens_servico")
    .update({
      tipo_atendimento: tipo,
      defeito_relatado: str(formData.get("defeito_relatado")),
      diagnostico: str(formData.get("diagnostico")),
      servico_executado: str(formData.get("servico_executado")),
      acompanha: str(formData.get("acompanha")),
      estado_aparelho: str(formData.get("estado_aparelho")),
      tecnico_id,
      tecnico,
      prioridade: (str(formData.get("prioridade")) as never) || "normal",
      data_previsao: tipo === "domicilio" ? dataVisita : null,
      turno: tipo === "domicilio" ? (turno as never) : null,
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
    if (tipo === "domicilio" && dataVisita && tecnico_id) {
      await sincronizarAgendamentoOs(supabase, {
        osId: id,
        clienteId: osAtual.cliente_id,
        numero: osAtual.numero,
        data: dataVisita,
        turno: turno || "dia",
        tecnico,
        tecnico_id,
      });
    } else if (tipo === "oficina") {
      await supabase.from("agendamentos").delete().eq("os_id", id);
      if (
        osAtual &&
        ["em_roteiro", "em_execucao", "cliente_ausente"].includes(osAtual.status)
      ) {
        await transicionarStatusOs(supabase, {
          osId: id,
          status: "em_analise",
          observacao: "Tipo alterado para oficina — visita domicílio removida",
          origem: "erp",
          sistema: true,
          papel: profile.papel,
        });
      }
    }

    if (tipo === "domicilio" && tecnico_id && tecnico_id !== osAtual.tecnico_id) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", osAtual.cliente_id)
        .single();
      notificarOsNova({
        tecnicoId: tecnico_id,
        osId: id,
        numero: osAtual.numero,
        clienteNome: cli?.nome,
        dataVisita,
      }).catch(() => {});
    }
  }

  const { error: delItensErr } = await supabase.from("os_itens").delete().eq("os_id", id);
  if (delItensErr) throw new Error(`Não foi possível atualizar itens: ${delItensErr.message}`);

  if (itens.length > 0) {
    const { error: insItensErr } = await supabase.from("os_itens").insert(
      itens.map((i) => ({
        os_id: id,
        tipo: i.tipo,
        descricao: i.descricao,
        quantidade: Number(i.quantidade) || 1,
        valor_unitario: Number(i.valor_unitario) || 0,
        custo_unitario: Number(i.custo_unitario) || 0,
      }))
    );
    if (insItensErr) throw new Error(`Não foi possível salvar itens: ${insItensErr.message}`);
  }

  if (osAtual) {
    const equipamentoIds = await resolverEquipamentosOs(
      supabase,
      osAtual.cliente_id,
      str(formData.get("equipamentos_json"))
    );
    await salvarVinculosEquipamentosOs(supabase, id, equipamentoIds);

    await requererReaprovacaoSeValoresMudaram(
      supabase,
      id,
      {
        aprovado: Boolean(osAtual.aprovado),
        valor_aprovado: osAtual.valor_aprovado != null ? Number(osAtual.valor_aprovado) : null,
        status: osAtual.status as StatusOS,
        valor_itens: Number(osAtual.valor_itens),
        valor_visita: Number(osAtual.valor_visita),
        abater_visita: Boolean(osAtual.abater_visita),
        desconto: Number(osAtual.desconto),
        acrescimo: Number(osAtual.acrescimo),
      },
      total
    );

    const { data: osPosReaprovacao } = await supabase
      .from("ordens_servico")
      .select("aprovado, status")
      .eq("id", id)
      .maybeSingle();

    if (
      osPosReaprovacao &&
      !osPosReaprovacao.aprovado &&
      deveEnviarAguardandoAprovacao({
        tipo,
        aprovado: false,
        status: osPosReaprovacao.status as StatusOS,
        valorItens,
        total,
      })
    ) {
      await transicionarStatusOs(supabase, {
        osId: id,
        status: "aguardando_aprovacao",
        observacao: "Orçamento enviado — aguardando aprovação do cliente",
        origem: "orcamento",
        sistema: true,
        papel: profile.papel,
        skipNotificacao: false,
      });
    }
  }

  const { data: osDepois } = await supabase
    .from("ordens_servico")
    .select("aprovado")
    .eq("id", id)
    .maybeSingle();

  if (osDepois?.aprovado) {
    await sincronizarFinanceiroOs(supabase, id, custoItens);
  }

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/dre");
  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/painel");
  redirect(`/ordens/${id}`);
}

export async function alterarStatusForm(id: string, formData: FormData) {
  const status = String(formData.get("status") || "aberta") as StatusOS;
  const observacao = str(formData.get("observacao")) || undefined;
  await alterarStatus(id, status, observacao);
}

export async function alterarStatus(id: string, status: StatusOS, observacao?: string) {
  const profile = await requirePermissao("ordens_editar");
  const supabase = await createClient();

  const { data: osAtual } = await supabase
    .from("ordens_servico")
    .select("status, tecnico_id, tecnico")
    .eq("id", id)
    .single();
  if (!osAtual) throw new Error("OS não encontrada.");

  assertOsAtribuida(profile, osAtual);

  if (status === "aprovada") {
    validarTransicaoStatus(osAtual.status as StatusOS, "aprovada", profile.papel);
    const result = await executarAprovacaoOs(supabase, {
      osId: id,
      obs: observacao ?? null,
      origem: "erp",
    });
    if (!result.ok) throw new Error(result.erro);

    revalidatePath("/financeiro");
    revalidatePath("/dashboard");
    revalidatePath("/dre");
    revalidatePath("/relatorios");
    revalidatePath("/financeiro/fluxo");
    revalidatePath(`/ordens/${id}`);
    revalidatePath("/ordens");
    revalidatePath("/agenda");
    revalidatePath("/campo");
    revalidatePath("/painel");
    return;
  }

  const result = await transicionarStatusOs(supabase, {
    osId: id,
    status,
    observacao,
    origem: "erp",
    papel: profile.papel,
  });

  if (result.mudou && (status === "aprovada" || status === "cancelada" || status === "concluida")) {
    revalidatePath("/financeiro");
    revalidatePath("/dashboard");
    revalidatePath("/dre");
    revalidatePath("/relatorios");
    revalidatePath("/financeiro/fluxo");
  }

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/ordens");
  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/painel");
}

// Lança a OS no financeiro: receita (valor total) + custo (despesa pendente).
export async function lancarFinanceiro(id: string, formData: FormData) {
  await requirePermissao("financeiro");
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, cliente_id, status, aprovado, tipo_atendimento, valor_itens, valor_visita, abater_visita, desconto, acrescimo, valor_total, custo_total, forma_pagamento"
    )
    .eq("id", id)
    .single();
  if (!os) throw new Error("OS não encontrada.");
  if (os.status === "cancelada") throw new Error("Não é possível lançar financeiro de OS cancelada.");

  if (
    os.tipo_atendimento === "domicilio" &&
    !os.aprovado &&
    Number(os.valor_itens) > 0
  ) {
    throw new Error(
      "Ordem domicílio com orçamento precisa de aprovação do cliente antes de lançar no financeiro."
    );
  }

  if (await temLancamentoAtivoOs(supabase, id)) {
    throw new Error("Esta OS já possui receita financeira. Edite os valores na OS para sincronizar.");
  }

  const valorFaturamento = calcReceitaFaturamentoOs(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
  const saldoCliente = calcValorTotalCliente(
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
  const hoje = hojeYmdLocal();

  const [{ data: catReceita }, { data: catCusto }] = await Promise.all([
    supabase.from("categorias_financeiras").select("id").eq("nome", "Serviços de assistência técnica").limit(1).single(),
    supabase.from("categorias_financeiras").select("id").eq("nome", "Compra de peças").limit(1).single(),
  ]);

  const jaPago = status === "pago";
  const lancamentos: Record<string, unknown>[] = [
    {
      tipo: "receita",
      descricao: `Receita ${numeroFmt}`,
      categoria_id: catReceita?.id ?? null,
      os_id: os.id,
      cliente_id: os.cliente_id,
      valor: valorFaturamento,
      valor_pago: jaPago ? valorFaturamento : 0,
      valor_liquido: jaPago ? valorFaturamento : null,
      data_competencia: hoje,
      data_vencimento: dataVencimento || hoje,
      data_pagamento: jaPago ? hoje : null,
      status,
      forma_pagamento: formaPagamento,
    },
  ];

  if (valorFaturamento <= 0) throw new Error("Valor da receita deve ser maior que zero.");

  if (saldoCliente !== Number(os.valor_total)) {
    await supabase.from("ordens_servico").update({ valor_total: saldoCliente }).eq("id", id);
  }

  // Custo da OS -> despesa sempre pendente (cliente pagar ≠ fornecedor pago)
  if (Number(os.custo_total) > 0) {
    const custo = Number(os.custo_total);
    lancamentos.push({
      tipo: "despesa",
      descricao: `Custo ${numeroFmt}`,
      categoria_id: catCusto?.id ?? null,
      os_id: os.id,
      cliente_id: os.cliente_id,
      valor: custo,
      valor_pago: 0,
      data_competencia: hoje,
      data_vencimento: hoje,
      status: "pendente",
      forma_pagamento: formaPagamento,
      observacoes: "Custo de peças/serviços da OS — pagar ao fornecedor separadamente",
    });
  }

  const { error } = await supabase.from("lancamentos_financeiros").insert(lancamentos);
  if (error) throw new Error(error.message);

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/dre");
  revalidatePath("/financeiro/fluxo");
  redirect(`/ordens/${id}`);
}

export async function aprovarOrcamentoComAssinatura(
  id: string,
  assinatura: string | null,
  obs: string | null
) {
  const profile = await requirePermissao("ordens_editar");
  const supabase = await createClient();

  if (profile.papel === "tecnico") {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("tecnico_id, tecnico")
      .eq("id", id)
      .single();
    if (!os) throw new Error("Ordem não encontrada.");
    assertOsAtribuida(profile, os);
  }

  const result = await executarAprovacaoOs(supabase, {
    osId: id,
    assinatura,
    obs,
    origem: profile.papel === "tecnico" ? "técnico no local" : "ERP",
  });

  if (!result.ok) throw new Error(result.erro);

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/ordens");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  revalidatePath("/campo");
  revalidatePath("/agenda");
  revalidatePath("/painel");
}

export async function salvarAssinatura(id: string, dataUrl: string) {
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
    .update({ assinatura_cliente: dataUrl })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/ordens/${id}`);
  revalidatePath("/imprimir/os/" + id);
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
    assertOsAtribuida(profile, os);
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
    .select("assinatura_tecnico, tecnico_id, tecnico")
    .eq("id", id)
    .single();
  if (!osAtual?.assinatura_tecnico) {
    throw new Error("O técnico deve assinar a ordem de serviço antes de registrar cliente ausente.");
  }
  if (profile.papel === "tecnico") {
    assertOsAtribuida(profile, osAtual);
  }
  if (!fotoUrl) throw new Error("Foto comprobatória é obrigatória.");

  const agora = new Date().toISOString();

  await supabase.from("os_anexos").insert({
    os_id: id,
    url: fotoUrl,
    path: fotoPath || "",
    momento: "cliente_ausente",
    descricao: observacao || "Cliente ausente — foto comprobatória",
  });

  await transicionarStatusOs(supabase, {
    osId: id,
    status: "cliente_ausente",
    observacao:
      observacao || `Cliente ausente — registrado por ${nomeTecnico(profile)}`,
    origem: "cliente-ausente",
    sistema: true,
    papel: profile.papel,
    skipNotificacao: true,
    extras: {
      observacao_cliente_ausente: observacao,
      cliente_ausente_registrado_at: agora,
    },
  });

  const [{ data: osInfo }, { data: cli }] = await Promise.all([
    supabase.from("ordens_servico").select("numero").eq("id", id).single(),
    supabase.from("ordens_servico").select("clientes(nome)").eq("id", id).single(),
  ]);
  // @ts-expect-error relação embutida
  const clienteNome = cli?.clientes?.nome as string | undefined;
  notificarClienteAusente({
    osId: id,
    numero: osInfo?.numero ?? 0,
    clienteNome,
    tecnicoNome: nomeTecnico(profile),
  }).catch(() => {});

  revalidatePath(`/ordens/${id}`);
  revalidatePath("/ordens");
  revalidatePath("/campo");
  revalidatePath("/agenda");
  revalidatePath("/imprimir/os/" + id);
}

/** Abre nova OS de retorno em garantia vinculada à original (dentro do prazo). */
export async function abrirRetornoGarantia(osOrigemId: string, formData: FormData) {
  await requirePermissao("ordens_editar");
  const supabase = await createClient();

  const { data: origem } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, cliente_id, equipamento_id, tipo_atendimento, tecnico, tecnico_id, forma_pagamento, garantia_dias, data_conclusao, status, defeito_relatado, diagnostico, servico_executado"
    )
    .eq("id", osOrigemId)
    .single();

  if (!origem) throw new Error("OS original não encontrada.");

  const check = podeAbrirRetornoGarantia(origem as never);
  if (!check.ok) throw new Error(check.motivo || "Não é possível abrir retorno em garantia.");

  const { data: retornoAberto } = await supabase
    .from("ordens_servico")
    .select("id, numero")
    .eq("os_origem_id", osOrigemId)
    .in("status", [
      "aberta",
      "em_analise",
      "aguardando_aprovacao",
      "aprovada",
      "em_roteiro",
      "em_execucao",
      "aguardando_peca",
      "cliente_ausente",
      "garantia",
    ])
    .maybeSingle();

  if (retornoAberto) {
    throw new Error(
      `Já existe retorno em aberto: OS-${String(retornoAberto.numero).padStart(5, "0")}.`
    );
  }

  const dataVisita = str(formData.get("data_previsao")) || hojeYmdLocal();
  const turno = (str(formData.get("turno")) || "manha") as "manha" | "tarde" | "dia";
  const defeito = str(formData.get("defeito_relatado")) || origem.defeito_relatado || "Retorno em garantia";
  const obsExtra = str(formData.get("observacoes"));
  const numeroFmt = `OS-${String(origem.numero).padStart(5, "0")}`;

  const { data: nova, error } = await supabase
    .from("ordens_servico")
    .insert({
      cliente_id: origem.cliente_id,
      equipamento_id: origem.equipamento_id,
      tipo_atendimento: origem.tipo_atendimento,
      motivo_atendimento: "retorno_garantia",
      os_origem_id: origem.id,
      status: origem.tipo_atendimento === "domicilio" ? "em_roteiro" : "garantia",
      defeito_relatado: defeito,
      diagnostico: origem.diagnostico,
      servico_executado: null,
      tecnico_id: origem.tecnico_id,
      tecnico: origem.tecnico,
      prioridade: "alta",
      data_previsao: origem.tipo_atendimento === "domicilio" ? dataVisita : null,
      turno: origem.tipo_atendimento === "domicilio" ? turno : null,
      valor_visita: 0,
      abater_visita: false,
      desconto: 0,
      acrescimo: 0,
      valor_itens: 0,
      custo_total: 0,
      valor_total: 0,
      valor_aprovado: 0,
      aprovado: true,
      data_aprovacao: new Date().toISOString(),
      forma_pagamento: origem.forma_pagamento,
      garantia_dias: origem.garantia_dias,
      observacoes: obsExtra || `Retorno em garantia da ${numeroFmt}`,
    })
    .select("id, numero")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("os_status_historico").insert({
    os_id: nova!.id,
    status: origem.tipo_atendimento === "domicilio" ? "em_roteiro" : "garantia",
    observacao: `Retorno em garantia aberto — referência ${numeroFmt}`,
  });

  if (origem.tipo_atendimento === "domicilio" && origem.tecnico_id) {
    await sincronizarAgendamentoOs(supabase, {
      osId: nova!.id,
      clienteId: origem.cliente_id,
      numero: nova!.numero,
      data: dataVisita,
      turno,
      tecnico: origem.tecnico || "",
      tecnico_id: origem.tecnico_id,
    });
  }

  await transicionarStatusOs(supabase, {
    osId: origem.id,
    status: "garantia",
    observacao: `Retorno em garantia aberto — nova OS ${nova!.numero}`,
    origem: "retorno-garantia",
    sistema: true,
    papel: "admin",
    skipNotificacao: true,
  });

  revalidatePath(`/ordens/${osOrigemId}`);
  revalidatePath("/ordens");
  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/painel");
  revalidatePath("/financeiro");
  redirect(`/ordens/${nova!.id}/editar`);
}

export async function excluirOrdem(id: string) {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("numero")
    .eq("id", id)
    .single();

  await limparDadosVinculadosOs(supabase, id, os?.numero);

  const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/ordens");
  revalidatePath("/financeiro");
  revalidatePath("/agenda");
  revalidatePath("/campo");
  revalidatePath("/dashboard");
  revalidatePath("/painel");
  redirect("/ordens");
}
