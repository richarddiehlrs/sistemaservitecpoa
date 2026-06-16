"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertCircle,
  CalendarClock,
  DollarSign,
  UserX,
  Clock,
  Wrench,
  Target,
  Receipt,
  CheckCheck,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatHora, formatNumeroOS } from "@/lib/format";
import { saldoEmAberto } from "@/lib/financeiro";
import { temPermissao, type Papel } from "@/lib/permissoes";
import {
  STATUS_AGENDA_PENDENTE,
  STATUS_OS_ATRASO,
  STATUS_OFICINA_PARADA,
  DIAS_OFICINA_PARADA_PADRAO,
  META_ALERTA_PERCENTUAL,
  hojeYmd,
  limiteFinanceiroYmd,
} from "@/lib/alertas";
import {
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  limparTodosAlertas,
  type AlertaDispensadoInput,
} from "@/app/(app)/notificacoes/actions";
import { useToast } from "@/components/toast";
import {
  type AlertaDispensadoEntry,
  alertaEstaDispensado,
  parseAlertasDispensados,
} from "@/lib/alertas-dispensados";

type OsAlerta = {
  id: string;
  numero: number;
  data_previsao: string | null;
  status?: string;
  updated_at?: string;
  clientes?: { nome?: string } | null;
};

type AgendaHoje = {
  id: string;
  titulo: string;
  hora_inicio: string | null;
  status: string;
  os_id: string | null;
  tecnico?: string | null;
};

type ContaAlerta = {
  id: string;
  descricao: string;
  valor: number;
  valor_pago: number;
  juros: number;
  multa: number;
  data_vencimento: string;
  tipo: "receita" | "despesa";
  os_id?: string | null;
};

type NotificacaoRow = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  url: string | null;
  prioridade: string;
  lida: boolean;
  created_at: string;
  ref_id?: string | null;
  ref_tipo?: string | null;
};

type DespesaCampo = {
  id: string;
  descricao: string;
  valor: number;
  tecnico: string | null;
};

export function Notifications({
  papel = "admin",
  userId,
  userNome,
}: {
  papel?: Papel;
  userId?: string;
  userNome?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventos, setEventos] = useState<NotificacaoRow[]>([]);
  const [atrasadas, setAtrasadas] = useState<OsAlerta[]>([]);
  const [oficinaParada, setOficinaParada] = useState<OsAlerta[]>([]);
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState<OsAlerta[]>([]);
  const [clienteAusente, setClienteAusente] = useState<OsAlerta[]>([]);
  const [aprovadasExecucao, setAprovadasExecucao] = useState<OsAlerta[]>([]);
  const [agenda, setAgenda] = useState<AgendaHoje[]>([]);
  const [contas, setContas] = useState<ContaAlerta[]>([]);
  const [despesasCampo, setDespesasCampo] = useState<DespesaCampo[]>([]);
  const [metaAlerta, setMetaAlerta] = useState<{ meta: number; realizado: number } | null>(null);
  const [diasOficina, setDiasOficina] = useState(DIAS_OFICINA_PARADA_PADRAO);
  const [dispensados, setDispensados] = useState<AlertaDispensadoEntry[]>([]);
  const [limpando, setLimpando] = useState(false);
  const toast = useToast();
  const [prefs, setPrefs] = useState({
    oficina_parada: true,
    financeiro: true,
    meta_faturamento: true,
    despesa_campo: true,
    os_aprovada: true,
    os_status: true,
    cliente_ausente: true,
  });
  const ref = useRef<HTMLDivElement>(null);

  const ehTecnico = papel === "tecnico";
  const verFinanceiro = temPermissao(papel, "financeiro");
  const verTodasOs = !ehTecnico;

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const carregarEventos = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, mensagem, url, prioridade, lida, created_at, ref_id, ref_tipo")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);
    setEventos((data as NotificacaoRow[]) || []);
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: prefData } = await supabase
        .from("preferencias_alertas")
        .select(
          "oficina_parada, financeiro, meta_faturamento, despesa_campo, os_aprovada, os_status, cliente_ausente, dias_oficina_parada, alertas_dispensados"
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (prefData) {
        setPrefs({
          oficina_parada: prefData.oficina_parada !== false,
          financeiro: prefData.financeiro !== false,
          meta_faturamento: prefData.meta_faturamento !== false,
          despesa_campo: prefData.despesa_campo !== false,
          os_aprovada: prefData.os_aprovada !== false,
          os_status: prefData.os_status !== false,
          cliente_ausente: prefData.cliente_ausente !== false,
        });
        setDiasOficina(prefData.dias_oficina_parada || DIAS_OFICINA_PARADA_PADRAO);
        setDispensados(parseAlertasDispensados(prefData.alertas_dispensados));
      }
    })();
  }, [userId, supabase]);

  const carregarOperacional = useCallback(async () => {
    const hoje = hojeYmd();
    const limiteStr = limiteFinanceiroYmd();
    const nomeTec = userNome || "";

    const limiteOficina = new Date();
    limiteOficina.setDate(limiteOficina.getDate() - diasOficina);
    const limiteOficinaStr = limiteOficina.toISOString();

    let qOsAtraso = supabase
      .from("ordens_servico")
      .select("id, numero, data_previsao, status, clientes(nome)")
      .in("status", [...STATUS_OS_ATRASO])
      .lt("data_previsao", hoje)
      .not("data_previsao", "is", null)
      .order("data_previsao", { ascending: true })
      .limit(10);

    if (ehTecnico && userId) {
      qOsAtraso = qOsAtraso.or(`tecnico_id.eq.${userId},tecnico.ilike.%${nomeTec}%`);
    }

    let qAgenda = supabase
      .from("agendamentos")
      .select("id, titulo, hora_inicio, status, os_id, tecnico")
      .eq("data", hoje)
      .in("status", [...STATUS_AGENDA_PENDENTE])
      .order("hora_inicio", { ascending: true })
      .limit(12);

    if (ehTecnico && userId) {
      qAgenda = qAgenda.or(`tecnico_id.eq.${userId},tecnico.ilike.%${nomeTec}%`);
    }

    const promessas: PromiseLike<unknown>[] = [qOsAtraso, qAgenda];

    if (verTodasOs && prefs.oficina_parada) {
      promessas.push(
        supabase
          .from("ordens_servico")
          .select("id, numero, status, updated_at, clientes(nome)")
          .eq("tipo_atendimento", "oficina")
          .in("status", [...STATUS_OFICINA_PARADA])
          .lt("updated_at", limiteOficinaStr)
          .order("updated_at", { ascending: true })
          .limit(8)
      );
    }

    if (verTodasOs && prefs.os_status) {
      promessas.push(
        supabase
          .from("ordens_servico")
          .select("id, numero, data_previsao, status, clientes(nome)")
          .eq("status", "aguardando_aprovacao")
          .order("data_abertura", { ascending: false })
          .limit(8)
      );
    }
    if (verTodasOs && prefs.cliente_ausente) {
      promessas.push(
        supabase
          .from("ordens_servico")
          .select("id, numero, data_previsao, status, clientes(nome)")
          .eq("status", "cliente_ausente")
          .order("cliente_ausente_registrado_at", { ascending: false })
          .limit(8)
      );
    }
    if (verTodasOs && prefs.os_aprovada) {
      promessas.push(
        supabase
          .from("ordens_servico")
          .select("id, numero, data_previsao, status, clientes(nome)")
          .eq("status", "aprovada")
          .order("data_aprovacao", { ascending: false })
          .limit(8)
      );
    }

    if (verFinanceiro && prefs.financeiro) {
      promessas.push(
        supabase
          .from("lancamentos_financeiros")
          .select("id, descricao, valor, valor_pago, juros, multa, data_vencimento, tipo, os_id")
          .in("status", ["pendente", "parcial"])
          .not("data_vencimento", "is", null)
          .lte("data_vencimento", limiteStr)
          .order("data_vencimento", { ascending: true })
          .limit(12)
      );
    }

    if (verTodasOs && prefs.despesa_campo) {
      promessas.push(
        supabase
          .from("lancamentos_financeiros")
          .select("id, descricao, valor, tecnico")
          .eq("tipo", "despesa")
          .eq("origem", "campo")
          .eq("status", "pendente")
          .order("created_at", { ascending: false })
          .limit(8)
      );
    }

    if (verFinanceiro && prefs.meta_faturamento) {
      const ano = new Date().getFullYear();
      const mes = new Date().getMonth() + 1;
      const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
      promessas.push(
        supabase.from("metas_faturamento").select("valor").eq("ano", ano).eq("mes", mes).maybeSingle(),
        supabase
          .from("lancamentos_financeiros")
          .select("valor_pago")
          .eq("tipo", "receita")
          .in("status", ["pago", "parcial"])
          .gte("data_pagamento", inicioMes)
      );
    }

    const resultados = await Promise.all(promessas);
    let idx = 0;

    const osR = resultados[idx++] as { data: OsAlerta[] | null };
    const agR = resultados[idx++] as { data: AgendaHoje[] | null };
    setAtrasadas(osR.data || []);
    setAgenda(agR.data || []);

    if (verTodasOs && prefs.oficina_parada) {
      const ofR = resultados[idx++] as { data: OsAlerta[] | null };
      setOficinaParada(ofR.data || []);
    } else {
      setOficinaParada([]);
    }

    if (verTodasOs && prefs.os_status) {
      const apR = resultados[idx++] as { data: OsAlerta[] | null };
      setAguardandoAprovacao(apR.data || []);
    } else {
      setAguardandoAprovacao([]);
    }
    if (verTodasOs && prefs.cliente_ausente) {
      const auR = resultados[idx++] as { data: OsAlerta[] | null };
      setClienteAusente(auR.data || []);
    } else {
      setClienteAusente([]);
    }
    if (verTodasOs && prefs.os_aprovada) {
      const axR = resultados[idx++] as { data: OsAlerta[] | null };
      setAprovadasExecucao(axR.data || []);
    } else {
      setAprovadasExecucao([]);
    }

    if (verFinanceiro && prefs.financeiro) {
      const ctR = resultados[idx++] as { data: ContaAlerta[] | null };
      setContas(ctR.data || []);
    } else {
      setContas([]);
    }

    if (verTodasOs && prefs.despesa_campo) {
      const dcR = resultados[idx++] as { data: DespesaCampo[] | null };
      setDespesasCampo(dcR.data || []);
    } else {
      setDespesasCampo([]);
    }

    if (verFinanceiro && prefs.meta_faturamento) {
      const metaR = resultados[idx++] as { data: { valor: number } | null };
      const recR = resultados[idx++] as { data: { valor_pago: number }[] | null };
      const meta = Number(metaR?.data?.valor || 0);
      const realizado = (recR?.data || []).reduce((s, r) => s + Number(r.valor_pago), 0);
      if (meta > 0 && realizado < meta * (META_ALERTA_PERCENTUAL / 100)) {
        setMetaAlerta({ meta, realizado });
      } else {
        setMetaAlerta(null);
      }
    } else {
      setMetaAlerta(null);
    }
  }, [supabase, ehTecnico, userId, userNome, verFinanceiro, verTodasOs, diasOficina, prefs]);

  useEffect(() => {
    carregarEventos();
    carregarOperacional();
    const t = setInterval(() => {
      carregarEventos();
      carregarOperacional();
    }, 60000);
    return () => clearInterval(t);
  }, [carregarEventos, carregarOperacional]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notificacoes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificacaoRow;
          setEventos((prev) => [row, ...prev.filter((p) => p.id !== row.id)].slice(0, 25));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificacaoRow;
          setEventos((prev) => prev.map((p) => (p.id === row.id ? row : p)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const hoje = hojeYmd();
  const visitasPendentes = agenda.filter((a) => a.status === "agendado" || a.status === "confirmado");

  function alertaOculto(refTipo: string, refId?: string | null) {
    if (alertaEstaDispensado(dispensados, refTipo, refId)) return true;
    return eventos.some((e) => {
      if (e.tipo === "sistema" && e.ref_tipo === refTipo) {
        if (refId == null || refId === "") return e.ref_id == null;
        return e.ref_id === refId;
      }
      if (e.lida) return false;
      if (refId == null || refId === "") return false;
      return e.ref_id === refId && (e.tipo === refTipo || e.ref_tipo === refTipo);
    });
  }

  function alertaOsOculto(osId: string, tipos: string[]) {
    return tipos.some((t) => alertaOculto(t, osId));
  }

  const atrasadasFiltradas = atrasadas.filter((o) => !alertaOculto("os_atraso", o.id));
  const oficinaParadaFiltrada = oficinaParada.filter((o) => !alertaOculto("oficina_parada", o.id));
  const aguardandoFiltrado = aguardandoAprovacao.filter(
    (o) => !alertaOsOculto(o.id, ["os_status", "os_aprovada"])
  );
  const aprovadasFiltradas = aprovadasExecucao.filter(
    (o) => !alertaOsOculto(o.id, ["os_aprovada", "os_status"])
  );
  const clienteAusenteFiltrado = clienteAusente.filter((o) => !alertaOculto("cliente_ausente", o.id));
  const despesasCampoFiltradas = despesasCampo.filter((d) => !alertaOculto("despesa_campo", d.id));
  const contasFiltradas = contas.filter((c) => !alertaOculto("financeiro", c.id));
  const visitasPendentesFiltradas = visitasPendentes.filter((a) => !alertaOculto("agenda_hoje", a.id));
  const agendaFiltrada = agenda.filter((a) => !alertaOculto("agenda_hoje", a.id));
  const metaOculta = metaAlerta ? alertaOculto("meta_faturamento", null) : true;

  const contasReceber = contasFiltradas.filter((c) => c.tipo === "receita");
  const contasPagar = contasFiltradas.filter((c) => c.tipo === "despesa");
  const contasVencidas = contasFiltradas.filter((c) => c.data_vencimento < hoje);

  const eventosNaoLidos = eventos.filter(
    (e) => e.tipo !== "sistema" && !e.lida && !alertaOculto(e.ref_tipo || e.tipo, e.ref_id)
  ).length;
  const eventosVisiveis = eventos.filter(
    (e) => e.tipo !== "sistema" && !e.lida && !alertaOculto(e.ref_tipo || e.tipo, e.ref_id)
  );

  const criticos =
    eventosNaoLidos +
    atrasadasFiltradas.length +
    aguardandoFiltrado.length +
    clienteAusenteFiltrado.length +
    aprovadasFiltradas.length +
    contasVencidas.length +
    oficinaParadaFiltrada.length;

  const total =
    criticos +
    visitasPendentesFiltradas.length +
    contasFiltradas.filter((c) => c.data_vencimento >= hoje).length +
    despesasCampoFiltradas.length +
    (metaAlerta && !metaOculta ? 1 : 0);

  const destinoAgenda = ehTecnico ? "/campo" : "/agenda";

  async function abrirEvento(n: NotificacaoRow) {
    if (!n.lida) {
      try {
        await marcarNotificacaoLida(n.id);
        setEventos((prev) => prev.map((e) => (e.id === n.id ? { ...e, lida: true } : e)));
      } catch {
        /* segue navegação */
      }
    }
    setOpen(false);
    if (n.url) router.push(n.url);
  }

  async function limparAlertas() {
    if (limpando) return;
    setLimpando(true);

    const items: AlertaDispensadoInput[] = [];

    atrasadas.forEach((o) => items.push({ ref_tipo: "os_atraso", ref_id: o.id }));
    oficinaParada.forEach((o) => items.push({ ref_tipo: "oficina_parada", ref_id: o.id }));
    aguardandoAprovacao.forEach((o) => items.push({ ref_tipo: "os_status", ref_id: o.id }));
    aprovadasExecucao.forEach((o) => items.push({ ref_tipo: "os_aprovada", ref_id: o.id }));
    clienteAusente.forEach((o) => items.push({ ref_tipo: "cliente_ausente", ref_id: o.id }));
    despesasCampo.forEach((d) => items.push({ ref_tipo: "despesa_campo", ref_id: d.id }));
    contas.forEach((c) => {
      items.push({ ref_tipo: "financeiro", ref_id: c.id });
      if (c.os_id) items.push({ ref_tipo: "financeiro", ref_id: c.os_id });
    });
    visitasPendentes.forEach((a) => items.push({ ref_tipo: "agenda_hoje", ref_id: a.id }));
    if (metaAlerta) items.push({ ref_tipo: "meta_faturamento", ref_id: null });

    eventos
      .filter((e) => e.tipo !== "sistema" && !e.lida)
      .forEach((e) => {
        items.push({ ref_tipo: e.ref_tipo || e.tipo, ref_id: e.ref_id ?? null });
        if (e.ref_id && e.ref_tipo && e.ref_tipo !== e.tipo) {
          items.push({ ref_tipo: e.tipo, ref_id: e.ref_id });
        }
      });

    try {
      const merged = await limparTodosAlertas(items);
      setDispensados(merged);
      setEventos((prev) => prev.map((e) => ({ ...e, lida: true })));
      toast.push("Alertas limpos.", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Não foi possível limpar os alertas.", "error");
    } finally {
      setLimpando(false);
    }
  }

  async function marcarTodas() {
    try {
      await marcarTodasNotificacoesLidas();
      setEventos((prev) => prev.map((e) => ({ ...e, lida: true })));
    } catch {
      /* silencioso */
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        title="Alertas e notificações"
        aria-label="Alertas"
      >
        <Bell className="h-5 w-5" />
        {total > 0 && (
          <span
            className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              criticos > 0 ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-hover">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Alertas</p>
                <p className="text-xs text-slate-400">
                  {total === 0
                    ? "Tudo em dia"
                    : criticos > 0
                      ? `${criticos} urgente(s) · ${total} no total`
                      : `${total} item(ns) para acompanhar`}
                </p>
              </div>
              {total > 0 && (
                <button
                  type="button"
                  onClick={limparAlertas}
                  disabled={limpando}
                  className="shrink-0 text-[10px] font-medium text-slate-600 hover:text-brand-600 hover:underline disabled:opacity-50"
                  title="Ocultar todos os alertas até a situação mudar"
                >
                  {limpando ? "Limpando…" : "Limpar alertas"}
                </button>
              )}
              {eventosNaoLidos > 0 && (
                <button
                  type="button"
                  onClick={marcarTodas}
                  className="shrink-0 text-[10px] font-medium text-brand-600 hover:underline"
                  title="Marcar eventos como lidos"
                >
                  <CheckCheck className="inline h-3 w-3" /> Lidas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {eventosVisiveis.length > 0 && (
              <Secao titulo="Eventos recentes" icon={<Bell className="h-4 w-4 text-brand-500" />} count={eventosNaoLidos}>
                {eventosVisiveis.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => abrirEvento(n)}
                    className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${
                      !n.lida ? "bg-brand-50/50" : ""
                    }`}
                  >
                    <span className="font-medium text-slate-800">{n.titulo}</span>
                    <span className="block truncate text-xs text-slate-500">{n.mensagem}</span>
                    {!n.lida && <span className="text-[10px] font-medium text-brand-600">Novo</span>}
                  </button>
                ))}
              </Secao>
            )}

            <Secao
              titulo="OS com visita atrasada"
              icon={<AlertCircle className="h-4 w-4 text-red-500" />}
              vazio={atrasadasFiltradas.length === 0}
              count={atrasadasFiltradas.length}
            >
              {atrasadasFiltradas.map((o) => (
                <ItemLink key={o.id} href={`/ordens/${o.id}`} onClose={() => setOpen(false)}>
                  <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                  <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                  <span className="block text-xs text-red-500">Previsto {formatDate(o.data_previsao)}</span>
                </ItemLink>
              ))}
            </Secao>

            {verTodasOs && prefs.oficina_parada && (
              <Secao
                titulo={`Oficina parada (+${diasOficina}d)`}
                icon={<Wrench className="h-4 w-4 text-orange-500" />}
                vazio={oficinaParadaFiltrada.length === 0}
                count={oficinaParadaFiltrada.length}
              >
                {oficinaParadaFiltrada.map((o) => (
                  <ItemLink key={o.id} href={`/ordens/${o.id}`} onClose={() => setOpen(false)}>
                    <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                    <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                    <span className="block text-xs text-orange-600">Em {o.status?.replace(/_/g, " ")}</span>
                  </ItemLink>
                ))}
              </Secao>
            )}

            {verTodasOs && prefs.os_aprovada && aprovadasFiltradas.length > 0 && (
              <Secao
                titulo="Aprovadas — aguardando execução"
                icon={<Wrench className="h-4 w-4 text-green-500" />}
                count={aprovadasFiltradas.length}
              >
                {aprovadasFiltradas.map((o) => (
                  <ItemLink key={o.id} href={`/ordens/${o.id}`} onClose={() => setOpen(false)}>
                    <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                    <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                    <span className="block text-xs text-green-600">Orçamento aprovado — iniciar serviço</span>
                  </ItemLink>
                ))}
              </Secao>
            )}

            {verTodasOs && prefs.os_status && (
              <Secao
                titulo="Aguardando aprovação"
                icon={<Clock className="h-4 w-4 text-amber-500" />}
                vazio={aguardandoFiltrado.length === 0}
                count={aguardandoFiltrado.length}
              >
                {aguardandoFiltrado.map((o) => (
                  <ItemLink key={o.id} href={`/ordens/${o.id}`} onClose={() => setOpen(false)}>
                    <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                    <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                  </ItemLink>
                ))}
              </Secao>
            )}

            {verTodasOs && prefs.cliente_ausente && (
              <Secao
                titulo="Cliente ausente"
                icon={<UserX className="h-4 w-4 text-rose-500" />}
                vazio={clienteAusenteFiltrado.length === 0}
                count={clienteAusenteFiltrado.length}
              >
                {clienteAusenteFiltrado.map((o) => (
                  <ItemLink key={o.id} href={`/ordens/${o.id}/editar`} onClose={() => setOpen(false)}>
                    <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                    <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                  </ItemLink>
                ))}
              </Secao>
            )}

            {verTodasOs && prefs.despesa_campo && (
              <Secao
                titulo="Despesas de campo"
                icon={<Receipt className="h-4 w-4 text-violet-500" />}
                vazio={despesasCampoFiltradas.length === 0}
                count={despesasCampoFiltradas.length}
              >
                {despesasCampoFiltradas.map((d) => (
                  <ItemLink key={d.id} href="/financeiro?origem=campo" onClose={() => setOpen(false)}>
                    <span className="text-slate-700">{d.descricao}</span>
                    <span className="block text-xs text-violet-600">
                      {d.tecnico} · {formatCurrency(d.valor)}
                    </span>
                  </ItemLink>
                ))}
              </Secao>
            )}

            <Secao
              titulo={ehTecnico ? "Minhas visitas hoje" : "Visitas pendentes hoje"}
              icon={<CalendarClock className="h-4 w-4 text-brand-500" />}
              vazio={agendaFiltrada.length === 0}
              count={visitasPendentesFiltradas.length || agendaFiltrada.length}
            >
              {agendaFiltrada.map((a) => (
                <ItemLink
                  key={a.id}
                  href={a.os_id ? `/ordens/${a.os_id}` : destinoAgenda}
                  onClose={() => setOpen(false)}
                >
                  <span className="font-medium text-slate-800">{formatHora(a.hora_inicio) || "—"}</span>{" "}
                  <span className="text-slate-500">{a.titulo}</span>
                </ItemLink>
              ))}
            </Secao>

            {verFinanceiro && prefs.financeiro && (
              <>
                <Secao
                  titulo="Contas a receber"
                  icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
                  vazio={contasReceber.length === 0}
                  count={contasReceber.length}
                >
                  {contasReceber.map((c) => {
                    const vencido = c.data_vencimento < hoje;
                    return (
                      <ItemLink key={c.id} href="/financeiro?vencidos=1" onClose={() => setOpen(false)}>
                        <span className="text-slate-700">{c.descricao}</span>
                        <span className={`block text-xs ${vencido ? "font-medium text-red-600" : "text-amber-600"}`}>
                          {formatCurrency(saldoEmAberto(c))} • {vencido ? "Vencido" : "Vence"}{" "}
                          {formatDate(c.data_vencimento)}
                        </span>
                      </ItemLink>
                    );
                  })}
                </Secao>
                <Secao
                  titulo="Contas a pagar"
                  icon={<DollarSign className="h-4 w-4 text-red-500" />}
                  vazio={contasPagar.length === 0}
                  count={contasPagar.length}
                >
                  {contasPagar.map((c) => {
                    const vencido = c.data_vencimento < hoje;
                    return (
                      <ItemLink key={c.id} href="/financeiro?vencidos=1" onClose={() => setOpen(false)}>
                        <span className="text-slate-700">{c.descricao}</span>
                        <span className={`block text-xs ${vencido ? "font-medium text-red-600" : "text-amber-600"}`}>
                          {formatCurrency(saldoEmAberto(c))} • {vencido ? "Vencido" : "Vence"}{" "}
                          {formatDate(c.data_vencimento)}
                        </span>
                      </ItemLink>
                    );
                  })}
                </Secao>
              </>
            )}

            {metaAlerta && !metaOculta && (
              <Secao titulo="Meta de faturamento" icon={<Target className="h-4 w-4 text-amber-500" />} count={1}>
                <ItemLink href="/dashboard" onClose={() => setOpen(false)}>
                  <span className="text-slate-700">
                    Realizado {formatCurrency(metaAlerta.realizado)} de {formatCurrency(metaAlerta.meta)}
                  </span>
                  <span className="block text-xs text-amber-600">
                    Abaixo de {META_ALERTA_PERCENTUAL}% da meta do mês
                  </span>
                </ItemLink>
              </Secao>
            )}
          </div>

          <div className="border-t border-slate-100 px-3 py-2">
            <Link
              href="/configuracoes/alertas"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-brand-600"
            >
              <Settings className="h-3.5 w-3.5" /> Configurar alertas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemLink({
  href,
  onClose,
  children,
}: {
  href: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} onClick={onClose} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
      {children}
    </Link>
  );
}

function Secao({
  titulo,
  icon,
  vazio,
  count,
  children,
}: {
  titulo: string;
  icon: React.ReactNode;
  vazio?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  if (vazio === true) {
    return null;
  }
  return (
    <div className="border-b border-slate-50 px-3 py-2 last:border-0">
      <p className="mb-1 flex items-center justify-between gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="flex items-center gap-1.5">
          {icon} {titulo}
        </span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span>
        )}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
