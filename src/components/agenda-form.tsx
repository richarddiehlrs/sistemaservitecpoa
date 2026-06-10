"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Search, X, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTelefone } from "@/lib/format";

type ClienteLite = { id: string; nome: string; telefone: string | null; endereco?: string };

export function AgendaForm({
  action,
  dataPadrao,
}: {
  action: (formData: FormData) => Promise<void>;
  dataPadrao?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();

  const [cliente, setCliente] = useState<ClienteLite | null>(null);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ClienteLite[]>([]);
  const [endereco, setEndereco] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (cliente || !busca.trim()) {
      setResultados([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const term = `%${busca.trim()}%`;
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone, logradouro, numero, bairro, cidade")
        .or(`nome.ilike.${term},telefone.ilike.${term}`)
        .order("nome")
        .limit(6);
      setResultados(
        (data || []).map((c: any) => ({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          endereco: [c.logradouro, c.numero, c.bairro, c.cidade].filter(Boolean).join(", "),
        }))
      );
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [busca, cliente, supabase]);

  function selecionar(c: ClienteLite) {
    setCliente(c);
    setResultados([]);
    setBusca("");
    if (c.endereco) setEndereco(c.endereco);
  }

  function handle(formData: FormData) {
    if (cliente) formData.set("cliente_id", cliente.id);
    startTransition(async () => {
      await action(formData);
      setAberto(false);
      setCliente(null);
      setEndereco("");
    });
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Novo agendamento
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="card my-8 w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Novo agendamento</h3>
          <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={handle} className="space-y-4">
          {/* Cliente (opcional) */}
          <div>
            <label className="label">Cliente (opcional)</label>
            {cliente ? (
              <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <UserCheck className="h-4 w-4 text-brand-600" /> {cliente.nome}
                </span>
                <button type="button" onClick={() => setCliente(null)} className="text-slate-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar cliente..." className="w-full bg-transparent py-2 text-sm outline-none" />
                </div>
                {resultados.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {resultados.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => selecionar(c)}
                          className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50">
                          <span className="font-medium">{c.nome}</span>
                          <span className="text-xs text-slate-500">{c.telefone ? formatTelefone(c.telefone) : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="label">Título / descrição *</label>
            <input name="titulo" required className="input"
              defaultValue={cliente ? `Visita - ${cliente.nome}` : ""} placeholder="Ex: Visita técnica - geladeira" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select name="tipo" className="input" defaultValue="visita">
                <option value="visita">Visita técnica</option>
                <option value="coleta">Coleta</option>
                <option value="entrega">Entrega</option>
                <option value="retorno">Retorno</option>
                <option value="orcamento">Orçamento</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="label">Técnico</label>
              <input name="tecnico" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Data *</label>
              <input type="date" name="data" required className="input"
                defaultValue={dataPadrao || new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="label">Início</label>
              <input type="time" name="hora_inicio" className="input" />
            </div>
            <div>
              <label className="label">Fim</label>
              <input type="time" name="hora_fim" className="input" />
            </div>
          </div>

          <div>
            <label className="label">Endereço do atendimento</label>
            <input name="endereco" className="input" value={endereco}
              onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro..." />
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea name="observacoes" rows={2} className="input" />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Agendar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
