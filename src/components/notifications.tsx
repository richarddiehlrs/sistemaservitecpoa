"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertCircle, CalendarClock, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatHora, formatNumeroOS } from "@/lib/format";

type OsAtrasada = { id: string; numero: number; data_previsao: string; clientes?: { nome?: string } | null };
type AgendaHoje = { id: string; titulo: string; hora_inicio: string | null };
type ContaVencer = { id: string; descricao: string; valor: number; data_vencimento: string };

const STATUS_ABERTOS = ["aberta", "em_analise", "aguardando_aprovacao", "aprovada", "em_roteiro", "em_execucao", "aguardando_peca"];

export function Notifications() {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [atrasadas, setAtrasadas] = useState<OsAtrasada[]>([]);
  const [agenda, setAgenda] = useState<AgendaHoje[]>([]);
  const [contas, setContas] = useState<ContaVencer[]>([]);
  const ref = useRef<HTMLDivElement>(null);

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
      const hoje = new Date().toISOString().slice(0, 10);
      const limite = new Date();
      limite.setDate(limite.getDate() + 3);
      const limiteStr = limite.toISOString().slice(0, 10);

      const [osR, agR, ctR] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("id, numero, data_previsao, clientes(nome)")
          .in("status", STATUS_ABERTOS)
          .lt("data_previsao", hoje)
          .not("data_previsao", "is", null)
          .order("data_previsao", { ascending: true })
          .limit(10),
        supabase
          .from("agendamentos")
          .select("id, titulo, hora_inicio")
          .eq("data", hoje)
          .neq("status", "cancelado")
          .order("hora_inicio", { ascending: true })
          .limit(10),
        supabase
          .from("lancamentos_financeiros")
          .select("id, descricao, valor, data_vencimento")
          .eq("tipo", "receita")
          .eq("status", "pendente")
          .not("data_vencimento", "is", null)
          .lte("data_vencimento", limiteStr)
          .order("data_vencimento", { ascending: true })
          .limit(10),
      ]);

      if (!ativo) return;
      setAtrasadas((osR.data as OsAtrasada[]) || []);
      setAgenda((agR.data as AgendaHoje[]) || []);
      setContas((ctR.data as ContaVencer[]) || []);
    }
    carregar();
    const t = setInterval(carregar, 60000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [supabase]);

  const total = atrasadas.length + agenda.length + contas.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        title="Notificações"
      >
        <Bell className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card-hover">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notificações</p>
            <p className="text-xs text-slate-400">{total === 0 ? "Tudo em dia 🎉" : `${total} item(ns) precisam de atenção`}</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <Secao titulo="OS atrasadas" icon={<AlertCircle className="h-4 w-4 text-red-500" />} vazio={atrasadas.length === 0}>
              {atrasadas.map((o) => (
                <Link key={o.id} href={`/ordens/${o.id}`} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>{" "}
                  <span className="text-slate-500">{o.clientes?.nome || ""}</span>
                  <span className="block text-xs text-red-500">Previsto p/ {formatDate(o.data_previsao)}</span>
                </Link>
              ))}
            </Secao>
            <Secao titulo="Agenda de hoje" icon={<CalendarClock className="h-4 w-4 text-brand-500" />} vazio={agenda.length === 0}>
              {agenda.map((a) => (
                <Link key={a.id} href="/agenda" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{formatHora(a.hora_inicio) || "—"}</span>{" "}
                  <span className="text-slate-500">{a.titulo}</span>
                </Link>
              ))}
            </Secao>
            <Secao titulo="Contas a vencer" icon={<DollarSign className="h-4 w-4 text-amber-500" />} vazio={contas.length === 0}>
              {contas.map((c) => (
                <Link key={c.id} href="/financeiro" onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="text-slate-700">{c.descricao}</span>
                  <span className="block text-xs text-amber-600">{formatCurrency(c.valor)} • vence {formatDate(c.data_vencimento)}</span>
                </Link>
              ))}
            </Secao>
          </div>
        </div>
      )}
    </div>
  );
}

function Secao({
  titulo,
  icon,
  vazio,
  children,
}: {
  titulo: string;
  icon: React.ReactNode;
  vazio: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-50 px-3 py-2 last:border-0">
      <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icon} {titulo}
      </p>
      {vazio ? <p className="px-2 py-1 text-xs text-slate-300">Nada por aqui.</p> : <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
