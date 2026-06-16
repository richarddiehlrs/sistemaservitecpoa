"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Wrench, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatNumeroOS, formatTelefone, STATUS_OS_LABEL } from "@/lib/format";
import { extrairReferenciaOs } from "@/lib/os-scan";
import type { Papel } from "@/lib/permissoes";

type CliRes = { id: string; nome: string; telefone: string | null };
type OsRes = { id: string; numero: number; status: string; clientes?: { nome?: string } | null };

function filtroTecnicoOr(papel?: Papel, userId?: string, userNome?: string): string | null {
  if (papel !== "tecnico" || !userId) return null;
  const nome = (userNome || "").trim();
  return nome
    ? `tecnico_id.eq.${userId},tecnico.ilike.%${nome}%`
    : `tecnico_id.eq.${userId}`;
}

export function GlobalSearch({
  papel,
  userId,
  userNome,
}: {
  papel?: Papel;
  userId?: string;
  userNome?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<CliRes[]>([]);
  const [ordens, setOrdens] = useState<OsRes[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const deb = useRef<ReturnType<typeof setTimeout>>();
  const filtroTecnico = filtroTecnicoOr(papel, userId, userNome);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setClientes([]);
      setOrdens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      const refOs = extrairReferenciaOs(q);
      if (refOs) {
        let osRef =
          refOs.tipo === "id"
            ? supabase.from("ordens_servico").select("id, numero, status, clientes(nome)").eq("id", refOs.valor).limit(1)
            : supabase
                .from("ordens_servico")
                .select("id, numero, status, clientes(nome)")
                .eq("numero", refOs.valor)
                .limit(1);
        if (filtroTecnico) osRef = osRef.or(filtroTecnico);
        const { data } = await osRef;
        if (data?.[0]) {
          go(`/ordens/${data[0].id}`);
          return;
        }
      }

      const term = `%${q.trim()}%`;
      const numero = parseInt(q.replace(/\D/g, ""), 10);

      const cliReq = supabase
        .from("clientes")
        .select("id, nome, telefone")
        .or(`nome.ilike.${term},telefone.ilike.${term},cpf_cnpj.ilike.${term}`)
        .order("nome")
        .limit(5);

      let osReq =
        !Number.isNaN(numero) && numero > 0
          ? supabase
              .from("ordens_servico")
              .select("id, numero, status, clientes(nome)")
              .eq("numero", numero)
              .limit(5)
          : supabase
              .from("ordens_servico")
              .select("id, numero, status, clientes(nome)")
              .order("data_abertura", { ascending: false })
              .limit(3);

      if (filtroTecnico) osReq = osReq.or(filtroTecnico);

      const [cli, os] = await Promise.all([cliReq, osReq]);
      setClientes((cli.data as CliRes[]) || []);
      setOrdens((os.data as unknown as OsRes[]) || []);
      setLoading(false);
    }, 250);
  }, [q, supabase, filtroTecnico]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const semResultados = !loading && clientes.length === 0 && ordens.length === 0;

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q && setOpen(true)}
        placeholder={papel === "tecnico" ? "Buscar minhas OS ou cliente..." : "Buscar OS, cliente ou telefone..."}
        className="input pl-9"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-card-hover">
          {ordens.length > 0 && (
            <div className="mb-1">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ordens</p>
              {ordens.map((o) => (
                <button
                  key={o.id}
                  onClick={() => go(`/ordens/${o.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <Wrench className="h-4 w-4 text-brand-500" />
                  <span className="font-medium text-slate-800">{formatNumeroOS(o.numero)}</span>
                  <span className="truncate text-slate-500">{o.clientes?.nome || ""}</span>
                  <span className="ml-auto text-xs text-slate-400">{STATUS_OS_LABEL[o.status] || o.status}</span>
                </button>
              ))}
            </div>
          )}
          {clientes.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Clientes</p>
              {clientes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/clientes/${c.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-800">{c.nome}</span>
                  {c.telefone && <span className="ml-auto text-xs text-slate-400">{formatTelefone(c.telefone)}</span>}
                </button>
              ))}
            </div>
          )}
          {semResultados && (
            <p className="px-2 py-6 text-center text-sm text-slate-400">Nenhum resultado para “{q}”.</p>
          )}
        </div>
      )}
    </div>
  );
}
