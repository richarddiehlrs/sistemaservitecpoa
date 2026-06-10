"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertCircle, CalendarClock, DollarSign, UserX, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatHora, formatNumeroOS } from "@/lib/format";
import { saldoEmAberto } from "@/lib/financeiro";
import { temPermissao, type Papel } from "@/lib/permissoes";
import {
  STATUS_AGENDA_PENDENTE,
  STATUS_OS_ATRASO,
  hojeYmd,
  limiteFinanceiroYmd,
} from "@/lib/alertas";

type OsAlerta = {
  id: string;
  numero: number;
  data_previsao: string;
  status?: string;
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

type ContaVencer = {
  id: string;
  descricao: string;
  valor: number;
  valor_pago: number;
  juros: number;
  multa: number;
  data_vencimento: string;
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
  const [open, setOpen] = useState(false);
  const [atrasadas, setAtrasadas] = useState<OsAlerta[]>([]);
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState<OsAlerta[]>([]);
  const [clienteAusente, setClienteAusente] = useState<OsAlerta[]>([]);
  const [agenda, setAgenda] = useState<AgendaHoje[]>([]);
  const [contas, setContas] = useState<ContaVencer[]>([]);
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

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const hoje = hojeYmd();
      const limiteStr = limiteFinanceiroYmd();
      const nomeTec = userNome || "";

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

      let qAprovacao: ReturnType<typeof supabase.from> | null = null;
      let qAusente: ReturnType<typeof supabase.from> | null = null;
      let qContas: ReturnType<typeof supabase.from> | null = null;

      if (verTodasOs) {
        qAprovacao = supabase
          .from("ordens_servico")
          .select("id, numero, data_previsao, status, clientes(nome)")
          .eq("status", "aguardando_aprovacao")
          .order("data_abertura", { ascending: false })
          .limit(8);
        qAusente = supabase
          .from("ordens_servico")
          .select("id, numero, data_previsao, status, clientes(nome)")
          .eq("status", "cliente_ausente")
          .order("cliente_ausente_registrado_at", { ascending: false })
          .limit(8);
        promessas.push(qAprovacao, qAusente);
      }

      if (verFinanceiro) {
        qContas = supabase
          .from("lancamentos_financeiros")
          .select("id, descricao, valor, valor_pago, juros, multa, data_vencimento")
          .eq("tipo", "receita")
          .in("status", ["pendente", "parcial"])
          .not("data_vencimento", "is", null)
          .lte("data_vencimento", limiteStr)
          .order("data_vencimento", { ascending: true })
          .limit(10);
        promessas.push(qContas);
      }

      const resultados = await Promise.all(promessas);
      if (!ativo) return;

      const osR = resultados[0] as { data: OsAlerta[] | null };
      const agR = resultados[1] as { data: AgendaHoje[] | null };
      let idx = 2;

      setAtrasadas(osR.data || []);
      setAgenda(agR.data || []);

      if (verTodasOs) {
        const apR = resultados[idx++] as { data: OsAlerta[] | null };
        const auR = resultados[idx++] as { data: OsAlerta[] | null };
        setAguardandoAprovacao(apR.data || []);
        setClienteAusente(auR.data || []);
      } else {
        setAguardandoAprovacao([]);
        setClienteAusente([]);
      }

      if (verFinanceiro) {
        const ctR = resultados[idx] as { data: ContaVencer[] | null };
        setContas(ctR.data || []);
      } else {
        setContas([]);
      }
    }

    carregar();
    const t = setInterval(carregar, 60000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [supabase, ehTecnico, userId, userNome, verFinanceiro, verTodasOs]);

  const hoje = hojeYmd();
  const contasVencidas = contas.filter((c) => c.data_vencimento < hoje);
  const visitasPendentes = agenda.filter((a) => a.status === "agendado" || a.status === "confirmado");

  const criticos =
    atrasadas.length +
    aguardandoAprovacao.length +
    clienteAusente.length +
    contasVencidas.length;

  const total =
    criticos +
    visitasPendentes.length +
    contas.filter((c) => c.data_vencimento >= hoje).length;

  const destinoAgenda = ehTecnico ? "/campo" : "/agenda";

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
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-hover">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Alertas</p>
            <p className="text-xs text-slate-400">
              {total === 0
                ? "Tudo em dia"
                : criticos > 0
                  ? `${criticos} urgente(s) · ${total} no total`
                  : `${total} item(ns) para acompanhar`}
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <Secao
              titulo="OS com visita atrasada"
              icon={<AlertCircle className="h-4 w-4 text-red-500" />}
              vazio={atrasadas.length === 0}
              count={atrasadas.length}
            >
              {atrasadas.map((o) => (
                <ItemLink key={o.id} href={`/ordens/${o.id}`} onClose={() => setOpen(false)}>
                  <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                  <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                  <span className="block text-xs text-red-500">Previsto {formatDate(o.data_previsao)}</span>
                </ItemLink>
              ))}
            </Secao>

            {verTodasOs && (
              <Secao
                titulo="Aguardando aprovação do cliente"
                icon={<Clock className="h-4 w-4 text-amber-500" />}
                vazio={aguardandoAprovacao.length === 0}
                count={aguardandoAprovacao.length}
              >
                {aguardandoAprovacao.map((o) => (
                  <ItemLink key={o.id} href={`/ordens/${o.id}`} onClose={() => setOpen(false)}>
                    <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                    <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                    <span className="block text-xs text-amber-600">Orçamento no portal</span>
                  </ItemLink>
                ))}
              </Secao>
            )}

            {verTodasOs && (
              <Secao
                titulo="Cliente ausente — reagendar"
                icon={<UserX className="h-4 w-4 text-rose-500" />}
                vazio={clienteAusente.length === 0}
                count={clienteAusente.length}
              >
                {clienteAusente.map((o) => (
                  <ItemLink key={o.id} href={`/ordens/${o.id}/editar`} onClose={() => setOpen(false)}>
                    <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                    <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                    <span className="block text-xs text-rose-600">Nova data na OS</span>
                  </ItemLink>
                ))}
              </Secao>
            )}

            <Secao
              titulo={ehTecnico ? "Minhas visitas hoje" : "Visitas pendentes hoje"}
              icon={<CalendarClock className="h-4 w-4 text-brand-500" />}
              vazio={agenda.length === 0}
              count={visitasPendentes.length || agenda.length}
            >
              {agenda.map((a) => (
                <ItemLink
                  key={a.id}
                  href={a.os_id ? `/ordens/${a.os_id}` : destinoAgenda}
                  onClose={() => setOpen(false)}
                >
                  <span className="font-medium text-slate-800">{formatHora(a.hora_inicio) || "—"}</span>{" "}
                  <span className="text-slate-500">{a.titulo}</span>
                  {!ehTecnico && a.tecnico && (
                    <span className="block text-xs text-slate-400">{a.tecnico}</span>
                  )}
                  {a.status === "em_atendimento" && (
                    <span className="block text-xs text-blue-600">Em atendimento</span>
                  )}
                </ItemLink>
              ))}
            </Secao>

            {verFinanceiro && (
              <Secao
                titulo="Contas a receber"
                icon={<DollarSign className="h-4 w-4 text-amber-500" />}
                vazio={contas.length === 0}
                count={contas.length}
              >
                {contas.map((c) => {
                  const vencido = c.data_vencimento < hoje;
                  return (
                    <ItemLink key={c.id} href="/financeiro?vencidos=1" onClose={() => setOpen(false)}>
                      <span className="text-slate-700">{c.descricao}</span>
                      <span className={`block text-xs ${vencido ? "font-medium text-red-600" : "text-amber-600"}`}>
                        {formatCurrency(saldoEmAberto(c))} • {vencido ? "Vencido" : "Vence"} {formatDate(c.data_vencimento)}
                      </span>
                    </ItemLink>
                  );
                })}
              </Secao>
            )}
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
  vazio: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-50 px-3 py-2 last:border-0">
      <p className="mb-1 flex items-center justify-between gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="flex items-center gap-1.5">
          {icon} {titulo}
        </span>
        {!vazio && count != null && count > 0 && (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span>
        )}
      </p>
      {vazio ? <p className="px-2 py-1 text-xs text-slate-300">Nada por aqui.</p> : <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
