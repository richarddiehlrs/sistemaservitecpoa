"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CloudOff,
  Fuel,
  Loader2,
  Package,
  ParkingCircle,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  Utensils,
  Wrench,
  X,
} from "lucide-react";
import { formatCurrency, formatDate, hojeYmdLocal, parseNumForm } from "@/lib/format";
import { comprimirFoto } from "@/lib/imagem";
import {
  guardarDespesa,
  listarPendentes,
  novoIdCliente,
  removerPendente,
  sincronizarFila,
  type DespesaPendente,
} from "@/lib/fila-offline";
import { useToast } from "./toast";

const CATEGORIAS = [
  { id: "combustivel", label: "Combustível", icon: Fuel },
  { id: "pecas", label: "Peças", icon: Package },
  { id: "alimentacao", label: "Alimentação", icon: Utensils },
  { id: "estacionamento", label: "Estacion. / pedágio", icon: ParkingCircle },
  { id: "ferramenta", label: "Ferramentas", icon: Wrench },
  { id: "outro", label: "Outros", icon: Receipt },
] as const;

const FORMAS = ["PIX", "Cartão de débito", "Cartão de crédito", "Dinheiro"] as const;

export type ContaDespesa = { id: string; nome: string; tipo: string; formas_padrao: string[] };

/** Conta sugerida para a forma de pagamento (nunca a maquininha, que só recebe). */
function contaSugerida(contas: ContaDespesa[], forma: string): string {
  const pagaveis = contas.filter((c) => c.tipo !== "maquininha");
  return (
    pagaveis.find((c) => c.formas_padrao.includes(forma))?.id ??
    pagaveis.find((c) => c.tipo === "banco")?.id ??
    ""
  );
}

export function DespesaCampoApp({
  osOpcoes,
  contas,
}: {
  osOpcoes: { id: string; label: string }[];
  contas: ContaDespesa[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [pendentes, setPendentes] = useState<DespesaPendente[]>([]);
  const [online, setOnline] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const atualizarFila = useCallback(async () => setPendentes(await listarPendentes()), []);

  const sincronizar = useCallback(
    async (avisar = false) => {
      setEnviando(true);
      const r = await sincronizarFila();
      setEnviando(false);
      await atualizarFila();
      if (r.enviados > 0) {
        if (avisar) toast.push(`${r.enviados} despesa(s) enviada(s) ao financeiro.`, "success");
        router.refresh();
      }
      return r;
    },
    [atualizarFila, router, toast]
  );

  useEffect(() => {
    setOnline(navigator.onLine);
    atualizarFila();
    sincronizar(true);
    const on = () => {
      setOnline(true);
      sincronizar(true);
    };
    const off = () => setOnline(false);
    const visivel = () => document.visibilityState === "visible" && sincronizar(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    document.addEventListener("visibilitychange", visivel);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [atualizarFila, sincronizar]);

  async function salvar(d: DespesaPendente) {
    await guardarDespesa(d);
    setAberto(false);
    await atualizarFila();
    if (!navigator.onLine) {
      toast.push("Sem sinal: despesa salva no celular. Será enviada sozinha quando a internet voltar.", "success");
      return;
    }
    const r = await sincronizar(false);
    const ficou = (await listarPendentes()).find((p) => p.idCliente === d.idCliente);
    if (!ficou) toast.push("Despesa lançada e já paga no financeiro.", "success");
    else if (ficou.erro) toast.push(`Não foi possível lançar: ${ficou.erro}`, "error");
    else if (r.falhas) toast.push("Sinal fraco: despesa salva no celular, será reenviada automaticamente.", "success");
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setAberto(true)} className="btn-primary w-full sm:w-auto">
        <Plus className="h-4 w-4" /> Lançar despesa
      </button>

      {(pendentes.length > 0 || !online) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-medium">
              <CloudOff className="h-4 w-4" />
              {online ? `${pendentes.length} despesa(s) aguardando envio` : `Sem internet — ${pendentes.length} salva(s) no celular`}
            </p>
            {online && pendentes.length > 0 && (
              <button type="button" className="btn-secondary py-1 text-xs" onClick={() => sincronizar(true)} disabled={enviando}>
                {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Enviar agora
              </button>
            )}
          </div>
          {pendentes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {pendentes.map((p) => (
                <li key={p.idCliente} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {formatDate(p.data)} • {CATEGORIAS.find((c) => c.id === p.categoria)?.label} • {formatCurrency(p.valor)}
                    {p.erro && <span className="block text-red-700">Erro: {p.erro}</span>}
                  </span>
                  {p.erro && (
                    <button
                      type="button"
                      className="shrink-0 text-red-700 underline"
                      onClick={async () => {
                        if (!window.confirm("Descartar esta despesa salva no celular?")) return;
                        await removerPendente(p.idCliente);
                        atualizarFila();
                      }}
                    >
                      Descartar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {aberto && <FormDespesa osOpcoes={osOpcoes} contas={contas} onClose={() => setAberto(false)} onSalvar={salvar} />}
    </div>
  );
}

function FormDespesa({
  osOpcoes,
  contas,
  onClose,
  onSalvar,
}: {
  osOpcoes: { id: string; label: string }[];
  contas: ContaDespesa[];
  onClose: () => void;
  onSalvar: (d: DespesaPendente) => Promise<void>;
}) {
  const hoje = hojeYmdLocal();
  const [categoria, setCategoria] = useState<string>("combustivel");
  const [forma, setForma] = useState<string>("PIX");
  const [conta, setConta] = useState<string>(() => contaSugerida(contas, "PIX"));
  const [foto, setFoto] = useState<Blob | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [processandoFoto, setProcessandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa);
  }, [previa]);

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setProcessandoFoto(true);
    try {
      const b = await comprimirFoto(f);
      setFoto(b);
      setPrevia(URL.createObjectURL(b));
    } finally {
      setProcessandoFoto(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const valor = parseNumForm(fd.get("valor"));
    if (valor <= 0) return setErro("Informe o valor.");
    const data = String(fd.get("data") || hoje);
    if (data > hoje) return setErro("A data não pode ser no futuro.");
    const km = parseInt(String(fd.get("km") || ""), 10);
    const litros = parseNumForm(fd.get("litros"));
    setSalvando(true);
    try {
      await onSalvar({
        idCliente: novoIdCliente(),
        categoria,
        valor: Math.round(valor * 100) / 100,
        data,
        contaId: conta || null,
        forma,
        osId: String(fd.get("os_id") || "") || null,
        descricao: String(fd.get("descricao") || "").trim() || null,
        km: Number.isFinite(km) && km > 0 ? km : null,
        litros: litros > 0 ? litros : null,
        foto,
        criadoEm: Date.now(),
        tentativas: 0,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const contasPagaveis = contas.filter((c) => c.tipo !== "maquininha");

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold">Nova despesa</h3>
          <button type="button" onClick={onClose} className="text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIAS.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoria(c.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-medium ${
                    categoria === c.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {c.label}
                </button>
              );
            })}
          </div>

          <div>
            <label className="label">Valor (R$)</label>
            <input name="valor" inputMode="decimal" required autoFocus className="input text-2xl font-semibold" placeholder="0,00" />
          </div>

          <div>
            <label className="label">Comprovante</label>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={escolherFoto} />
            {previa ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previa} alt="Comprovante" className="max-h-48 w-full rounded-lg object-contain ring-1 ring-slate-200" />
                <button
                  type="button"
                  onClick={() => {
                    setFoto(null);
                    setPrevia(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1 shadow"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => cameraRef.current?.click()} className="btn-secondary w-full py-3" disabled={processandoFoto}>
                {processandoFoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                Fotografar nota / cupom
              </button>
            )}
          </div>

          <div>
            <label className="label">Pago com</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setForma(f);
                    setConta(contaSugerida(contas, f));
                  }}
                  className={`rounded-lg border px-2 py-2 text-sm ${forma === f ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 text-slate-600"}`}
                >
                  {f === "Cartão de débito" ? "Débito" : f === "Cartão de crédito" ? "Crédito" : f}
                </button>
              ))}
            </div>
            {contasPagaveis.length > 1 && (
              <select value={conta} onChange={(e) => setConta(e.target.value)} className="input mt-2 text-sm">
                {contasPagaveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    Saiu de: {c.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          {categoria === "combustivel" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Km do carro</label>
                <input name="km" inputMode="numeric" className="input" placeholder="Ex.: 85320" />
              </div>
              <div>
                <label className="label">Litros</label>
                <input name="litros" inputMode="decimal" className="input" placeholder="Ex.: 40,5" />
              </div>
            </div>
          )}

          {osOpcoes.length > 0 && (
            <div>
              <label className="label">{categoria === "pecas" ? "Peça para qual OS?" : "Vincular à OS (opcional)"}</label>
              <select name="os_id" className="input text-sm" defaultValue="">
                <option value="">— Nenhuma —</option>
                {osOpcoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {categoria === "pecas" && (
                <p className="mt-1 text-[11px] text-slate-500">Vinculada à OS, a peça entra no custo e no lucro daquela OS.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Data</label>
              <input name="data" type="date" max={hoje} defaultValue={hoje} className="input" />
            </div>
            <div>
              <label className="label">Onde / o quê</label>
              <input name="descricao" className="input" placeholder={categoria === "combustivel" ? "Posto" : "Descrição"} />
            </div>
          </div>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          <button type="submit" className="btn-primary w-full py-3 text-base" disabled={salvando || processandoFoto}>
            {salvando && <Loader2 className="h-5 w-5 animate-spin" />}
            Salvar despesa
          </button>
          <p className="text-center text-[11px] text-slate-400">
            Entra como paga no financeiro. Sem internet, fica salva no celular e é enviada depois.
          </p>
        </form>
      </div>
    </div>
  );
}
