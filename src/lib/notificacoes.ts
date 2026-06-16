import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { enviarPushParaUsuario } from "@/lib/push";
import type { Papel } from "@/lib/permissoes";
import type { Database } from "@/types/database";

export type TipoNotificacao =
  | "os_nova"
  | "os_aprovada"
  | "os_status"
  | "cliente_ausente"
  | "despesa_campo"
  | "financeiro"
  | "oficina_parada"
  | "meta_faturamento"
  | "sistema";

export type PrioridadeNotificacao = "baixa" | "normal" | "alta" | "urgente";

export type PayloadNotificacao = {
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  url?: string;
  prioridade?: PrioridadeNotificacao;
  ref_tipo?: string;
  ref_id?: string;
};

type Preferencias = {
  push_ativo: boolean;
  os_nova: boolean;
  os_status: boolean;
  os_aprovada: boolean;
  cliente_ausente: boolean;
  despesa_campo: boolean;
  financeiro: boolean;
  oficina_parada: boolean;
  meta_faturamento: boolean;
};

const PREF_POR_TIPO: Record<TipoNotificacao, keyof Preferencias | null> = {
  os_nova: "os_nova",
  os_aprovada: "os_aprovada",
  os_status: "os_status",
  cliente_ausente: "cliente_ausente",
  despesa_campo: "despesa_campo",
  financeiro: "financeiro",
  oficina_parada: "oficina_parada",
  meta_faturamento: "meta_faturamento",
  sistema: null,
};

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key);
}

async function buscarPreferencias(userId: string): Promise<Preferencias> {
  const supabase = supabaseAdmin();
  const padrao: Preferencias = {
    push_ativo: true,
    os_nova: true,
    os_status: true,
    os_aprovada: true,
    cliente_ausente: true,
    despesa_campo: true,
    financeiro: true,
    oficina_parada: true,
    meta_faturamento: true,
  };
  if (!supabase) return padrao;

  const { data } = await supabase
    .from("preferencias_alertas")
    .select(
      "push_ativo, os_nova, os_status, os_aprovada, cliente_ausente, despesa_campo, financeiro, oficina_parada, meta_faturamento"
    )
    .eq("user_id", userId)
    .maybeSingle();

  return data ? { ...padrao, ...data } : padrao;
}

function tipoHabilitado(prefs: Preferencias, tipo: TipoNotificacao): boolean {
  const chave = PREF_POR_TIPO[tipo];
  if (!chave) return true;
  return prefs[chave] !== false;
}

export async function criarNotificacaoUsuario(userId: string, payload: PayloadNotificacao) {
  const supabase = supabaseAdmin();
  if (!supabase) return;

  const prefs = await buscarPreferencias(userId);
  if (!tipoHabilitado(prefs, payload.tipo)) return;

  const { error } = await supabase.from("notificacoes").insert({
    user_id: userId,
    tipo: payload.tipo,
    titulo: payload.titulo,
    mensagem: payload.mensagem,
    url: payload.url ?? null,
    prioridade: payload.prioridade ?? "normal",
    ref_tipo: payload.ref_tipo ?? null,
    ref_id: payload.ref_id ?? null,
  });
  if (error) console.error("[notificacoes]", error.message);

  if (prefs.push_ativo) {
    await enviarPushParaUsuario(userId, {
      title: payload.titulo,
      body: payload.mensagem,
      url: payload.url,
      tag: payload.ref_id ? `${payload.tipo}-${payload.ref_id}` : payload.tipo,
    }).catch(() => {});
  }
}

export async function notificarPorPapel(papeis: Papel[], payload: PayloadNotificacao) {
  const supabase = supabaseAdmin();
  if (!supabase) return;

  const { data: usuarios } = await supabase
    .from("profiles")
    .select("id")
    .in("papel", papeis)
    .eq("ativo", true);

  if (!usuarios?.length) return;

  await Promise.all(usuarios.map((u) => criarNotificacaoUsuario(u.id, payload)));
}

export async function notificarAdminsAtendentes(payload: PayloadNotificacao) {
  return notificarPorPapel(["admin", "atendente"], payload);
}

export type AlertaDispensado = {
  ref_tipo: string;
  ref_id?: string | null;
};

/** Registra alertas operacionais como vistos/dispensados pelo usuário. */
export async function dispensarAlertasUsuario(userId: string, items: AlertaDispensado[]) {
  const supabase = supabaseAdmin();
  if (!supabase || !items.length) return;

  const agora = new Date().toISOString();
  const rows = items.map((item) => ({
    user_id: userId,
    tipo: "sistema" as const,
    titulo: "Alerta dispensado",
    mensagem: "Ocultado pelo usuário",
    lida: true,
    lida_em: agora,
    ref_tipo: item.ref_tipo,
    ref_id: item.ref_id ?? null,
    prioridade: "baixa" as const,
  }));

  const { error } = await supabase.from("notificacoes").insert(rows);
  if (error) console.error("[notificacoes] dispensar:", error.message);
}

export async function notificarOsNova(opts: {
  tecnicoId: string;
  osId: string;
  numero: number;
  clienteNome?: string | null;
  dataVisita?: string | null;
}) {
  const { formatDate, formatNumeroOS } = await import("@/lib/format");
  const cliente = opts.clienteNome?.trim() || "Cliente";
  const quando = opts.dataVisita ? ` — visita ${formatDate(opts.dataVisita)}` : "";

  await criarNotificacaoUsuario(opts.tecnicoId, {
    tipo: "os_nova",
    titulo: "Novo atendimento atribuído",
    mensagem: `${formatNumeroOS(opts.numero)} • ${cliente}${quando}`,
    url: `/ordens/${opts.osId}`,
    prioridade: "alta",
    ref_tipo: "os",
    ref_id: opts.osId,
  });
}

export async function notificarOsAprovada(opts: {
  osId: string;
  numero: number;
  clienteNome?: string | null;
  tecnicoId?: string | null;
}) {
  const { formatNumeroOS } = await import("@/lib/format");
  const cliente = opts.clienteNome?.trim() || "Cliente";
  const numeroFmt = formatNumeroOS(opts.numero);

  const payload: PayloadNotificacao = {
    tipo: "os_aprovada",
    titulo: "Orçamento aprovado pelo cliente",
    mensagem: `${numeroFmt} • ${cliente} aprovou — pode executar`,
    url: `/ordens/${opts.osId}`,
    prioridade: "alta",
    ref_tipo: "os",
    ref_id: opts.osId,
  };

  await notificarAdminsAtendentes(payload);

  if (opts.tecnicoId) {
    const supabase = supabaseAdmin();
    const { data: tec } = supabase
      ? await supabase.from("profiles").select("papel").eq("id", opts.tecnicoId).maybeSingle()
      : { data: null };
    if (tec?.papel === "tecnico") {
      await criarNotificacaoUsuario(opts.tecnicoId, {
        ...payload,
        titulo: "Orçamento aprovado — execute o serviço",
        mensagem: `${numeroFmt} • ${cliente}`,
      });
    }
  }
}

export async function notificarClienteAusente(opts: {
  osId: string;
  numero: number;
  clienteNome?: string | null;
  tecnicoNome?: string | null;
}) {
  const { formatNumeroOS } = await import("@/lib/format");

  await notificarAdminsAtendentes({
    tipo: "cliente_ausente",
    titulo: "Cliente ausente — reagendar",
    mensagem: `${formatNumeroOS(opts.numero)} • ${opts.clienteNome || "Cliente"} (${opts.tecnicoNome || "técnico"})`,
    url: `/ordens/${opts.osId}/editar`,
    prioridade: "urgente",
    ref_tipo: "os",
    ref_id: opts.osId,
  });
}

export async function notificarDespesaCampo(opts: {
  lancamentoId?: string;
  valor: number;
  descricao: string;
  tecnicoNome: string;
}) {
  const { formatCurrency } = await import("@/lib/format");

  await notificarAdminsAtendentes({
    tipo: "despesa_campo",
    titulo: "Despesa de campo pendente",
    mensagem: `${opts.tecnicoNome}: ${opts.descricao} — ${formatCurrency(opts.valor)}`,
    url: "/financeiro?origem=campo",
    prioridade: "normal",
    ref_tipo: "lancamento",
    ref_id: opts.lancamentoId,
  });
}

export async function notificarReaprovacaoOrcamento(opts: {
  osId: string;
  numero: number;
  clienteNome?: string | null;
}) {
  const { formatNumeroOS } = await import("@/lib/format");

  await notificarAdminsAtendentes({
    tipo: "financeiro",
    titulo: "Orçamento alterado — reaprovação necessária",
    mensagem: `${formatNumeroOS(opts.numero)} • ${opts.clienteNome || "Cliente"} — receita pendente cancelada`,
    url: `/ordens/${opts.osId}`,
    prioridade: "alta",
    ref_tipo: "os",
    ref_id: opts.osId,
  });
}

export async function notificarMudancaStatusOs(opts: {
  osId: string;
  numero: number;
  status: string;
  clienteNome?: string | null;
  tecnicoId?: string | null;
}) {
  const { formatNumeroOS, STATUS_OS_LABEL } = await import("@/lib/format");
  const label = STATUS_OS_LABEL[opts.status] || opts.status;

  const payload: PayloadNotificacao = {
    tipo: "os_status",
    titulo: `OS atualizada: ${label}`,
    mensagem: `${formatNumeroOS(opts.numero)} • ${opts.clienteNome || "Cliente"}`,
    url: `/ordens/${opts.osId}`,
    prioridade: opts.status === "aguardando_peca" ? "alta" : "normal",
    ref_tipo: "os",
    ref_id: opts.osId,
  };

  await notificarAdminsAtendentes(payload);

  if (opts.tecnicoId) {
    await criarNotificacaoUsuario(opts.tecnicoId, payload);
  }
}
