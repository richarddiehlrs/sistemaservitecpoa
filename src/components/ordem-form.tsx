"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Trash2, UserCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buscarCep } from "@/lib/cep";
import { formatCurrency, formatTelefone, hojeYmdLocal } from "@/lib/format";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { TecnicoCargaTrabalho } from "@/components/tecnico-carga-trabalho";
import { SpellCheckInput, SpellCheckTextarea } from "@/components/spell-check-field";
import type { TecnicoOpcao } from "@/lib/tecnicos";
import type { Equipamento, OrdemServico, OsItem, ServicoCatalogo, TipoAtendimento } from "@/types/database";
import { TIPO_ATENDIMENTO_LABEL } from "@/lib/painel-atendimento";
import { Home, Wrench } from "lucide-react";

type ClienteLite = { id: string; nome: string; telefone: string | null };

type MoneyField = number | "";

function initMoney(v: number | null | undefined): MoneyField {
  const n = Number(v ?? 0);
  return n === 0 ? "" : n;
}

function parseMoneyInput(v: string): MoneyField {
  if (v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function moneyToNum(v: MoneyField): number {
  return v === "" ? 0 : Number(v);
}

type ItemState = {
  tipo: "servico" | "peca";
  descricao: string;
  quantidade: number;
  valor_unitario: MoneyField;
  custo_unitario: MoneyField;
};

type EquipSlot = {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  serie: string;
  voltagem: string;
  cor: string;
};

function equipToSlot(e: Equipamento): EquipSlot {
  return {
    id: e.id,
    tipo: e.tipo,
    marca: e.marca || "",
    modelo: e.modelo || "",
    serie: e.numero_serie || "",
    voltagem: e.voltagem || "",
    cor: e.cor || "",
  };
}

function emptyEquipSlot(): EquipSlot {
  return { id: "", tipo: "", marca: "", modelo: "", serie: "", voltagem: "", cor: "" };
}

type Props = {
  action: (formData: FormData) => Promise<void>;
  ordem?: OrdemServico;
  clienteInicial?: ClienteLite | null;
  equipamentos?: Equipamento[];
  equipamentosOsIniciais?: Equipamento[];
  itensIniciais?: OsItem[];
  catalogo?: ServicoCatalogo[];
  modoEdicao?: boolean;
  tecnicoPadrao?: string;
  tecnicoIdPadrao?: string;
  tecnicoFixo?: boolean;
  tecnicos?: TecnicoOpcao[];
  tipoInicial?: TipoAtendimento;
};

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function OrdemForm({
  action,
  ordem,
  clienteInicial,
  equipamentos = [],
  equipamentosOsIniciais = [],
  itensIniciais = [],
  catalogo = [],
  modoEdicao = false,
  tecnicoPadrao,
  tecnicoIdPadrao,
  tecnicoFixo = false,
  tecnicos = [],
  tipoInicial = "domicilio",
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [pending, startTransition] = useTransition();

  const tecnicoIdInicial = useMemo(() => {
    if (ordem?.tecnico_id) return ordem.tecnico_id;
    if (ordem?.tecnico) {
      const match = tecnicos.find(
        (t) => t.nome.toLowerCase() === ordem.tecnico!.toLowerCase()
      );
      return match?.id || "";
    }
    return tecnicoIdPadrao || "";
  }, [ordem, tecnicos, tecnicoIdPadrao]);

  const [tecnicoSelecionado, setTecnicoSelecionado] = useState(tecnicoIdInicial);
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento>(
    ordem?.tipo_atendimento || tipoInicial
  );
  const ehDomicilio = tipoAtendimento === "domicilio";

  // ---- Cliente ----
  const [modoCliente, setModoCliente] = useState<"existente" | "novo">(
    clienteInicial || modoEdicao ? "existente" : "novo"
  );
  const [cliente, setCliente] = useState<ClienteLite | null>(clienteInicial ?? null);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ClienteLite[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [novoCli, setNovoCli] = useState({
    nome: "", cpf_cnpj: "", telefone: "", email: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  });
  const [buscandoCep, setBuscandoCep] = useState(false);

  // ---- Equipamentos (múltiplos) ----
  const [equipExistentes, setEquipExistentes] = useState<Equipamento[]>(equipamentos);
  const [equipSlots, setEquipSlots] = useState<EquipSlot[]>(
    equipamentosOsIniciais.length > 0
      ? equipamentosOsIniciais.map(equipToSlot)
      : ordem?.equipamento_id && equipamentos.length
        ? [equipToSlot(equipamentos.find((e) => e.id === ordem.equipamento_id) || equipamentos[0])]
        : [emptyEquipSlot()]
  );

  // ---- Itens ----
  const [itens, setItens] = useState<ItemState[]>(
    itensIniciais.length > 0
      ? itensIniciais.map((i) => ({
          tipo: i.tipo,
          descricao: i.descricao,
          quantidade: Number(i.quantidade),
          valor_unitario: initMoney(i.valor_unitario),
          custo_unitario: initMoney(i.custo_unitario),
        }))
      : [{ tipo: "servico", descricao: "", quantidade: 1, valor_unitario: "", custo_unitario: "" }]
  );

  // ---- Valores ----
  const [valorVisita, setValorVisita] = useState<MoneyField>(initMoney(ordem?.valor_visita));
  const [abaterVisita, setAbaterVisita] = useState(ordem?.abater_visita ?? true);
  const [desconto, setDesconto] = useState<MoneyField>(initMoney(ordem?.desconto));
  const [acrescimo, setAcrescimo] = useState<MoneyField>(initMoney(ordem?.acrescimo));

  const valorItens = itens.reduce(
    (s, i) => s + (Number(i.quantidade) || 0) * moneyToNum(i.valor_unitario),
    0
  );
  const custoItens = itens.reduce(
    (s, i) => s + (Number(i.quantidade) || 0) * moneyToNum(i.custo_unitario),
    0
  );
  const totalGeral = calcValorTotalCliente(
    valorItens,
    moneyToNum(valorVisita),
    abaterVisita,
    moneyToNum(desconto),
    moneyToNum(acrescimo)
  );
  const lucro = totalGeral - custoItens;

  // Busca de clientes (debounce simples)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (modoCliente !== "existente" || cliente) return;
    if (!busca.trim()) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const term = `%${busca.trim()}%`;
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .or(`nome.ilike.${term},telefone.ilike.${term},cpf_cnpj.ilike.${term}`)
        .order("nome")
        .limit(8);
      setResultados(data || []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [busca, modoCliente, cliente, supabase]);

  async function selecionarCliente(c: ClienteLite) {
    setCliente(c);
    setResultados([]);
    setBusca("");
    const { data } = await supabase
      .from("equipamentos")
      .select("*")
      .eq("cliente_id", c.id)
      .order("created_at", { ascending: false });
    setEquipExistentes(data || []);
  }

  async function handleBuscarCep() {
    setBuscandoCep(true);
    const res = await buscarCep(novoCli.cep);
    setBuscandoCep(false);
    if (!res) return;
    setNovoCli((c) => ({
      ...c,
      logradouro: res.logradouro || c.logradouro,
      bairro: res.bairro || c.bairro,
      cidade: res.cidade || c.cidade,
      uf: res.uf || c.uf,
    }));
  }

  function addEquipSlot() {
    setEquipSlots((arr) => [...arr, emptyEquipSlot()]);
  }
  function updEquipSlot(idx: number, patch: Partial<EquipSlot>) {
    setEquipSlots((arr) => arr.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function selecionarEquipExistente(idx: number, equipamentoId: string) {
    const eq = equipExistentes.find((e) => e.id === equipamentoId);
    if (!eq) {
      updEquipSlot(idx, emptyEquipSlot());
      return;
    }
    updEquipSlot(idx, equipToSlot(eq));
  }
  function rmEquipSlot(idx: number) {
    setEquipSlots((arr) => (arr.length <= 1 ? [emptyEquipSlot()] : arr.filter((_, i) => i !== idx)));
  }

  function addItem() {
    setItens((arr) => [
      ...arr,
      { tipo: "servico", descricao: "", quantidade: 1, valor_unitario: "", custo_unitario: "" },
    ]);
  }
  function addDoCatalogo(id: string) {
    const s = catalogo.find((c) => c.id === id);
    if (!s) return;
    setItens((arr) => [
      ...arr,
      { tipo: s.tipo, descricao: s.descricao, quantidade: 1, valor_unitario: Number(s.valor), custo_unitario: "" },
    ]);
  }
  function updItem(idx: number, patch: Partial<ItemState>) {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function rmItem(idx: number) {
    setItens((arr) => arr.filter((_, i) => i !== idx));
  }

  function handleSubmit(formData: FormData) {
    if (modoCliente === "existente" && cliente) {
      formData.set("cliente_id", cliente.id);
    } else {
      formData.set("cliente_id", "");
      formData.set("novo_nome", novoCli.nome);
      formData.set("novo_cpf_cnpj", novoCli.cpf_cnpj);
      formData.set("novo_telefone", novoCli.telefone);
      formData.set("novo_email", novoCli.email);
      formData.set("novo_cep", novoCli.cep);
      formData.set("novo_logradouro", novoCli.logradouro);
      formData.set("novo_numero", novoCli.numero);
      formData.set("novo_complemento", novoCli.complemento);
      formData.set("novo_bairro", novoCli.bairro);
      formData.set("novo_cidade", novoCli.cidade);
      formData.set("novo_uf", novoCli.uf);
    }

    formData.set(
      "equipamentos_json",
      JSON.stringify(
        equipSlots
          .filter((s) => s.id || s.tipo.trim())
          .map((s) =>
            s.id
              ? { id: s.id }
              : {
                  tipo: s.tipo,
                  marca: s.marca,
                  modelo: s.modelo,
                  serie: s.serie,
                  voltagem: s.voltagem,
                  cor: s.cor,
                }
          )
      )
    );

    formData.set("tipo_atendimento", tipoAtendimento);
    formData.set(
      "itens_json",
      JSON.stringify(
        itens.map((i) => ({
          ...i,
          valor_unitario: moneyToNum(i.valor_unitario),
          custo_unitario: moneyToNum(i.custo_unitario),
        }))
      )
    );
    if (abaterVisita) formData.set("abater_visita", "on");
    else formData.delete("abater_visita");

    startTransition(async () => {
      await action(formData);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="tipo_atendimento" value={tipoAtendimento} />

      {/* ====================== TIPO DE ATENDIMENTO ====================== */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tipo de atendimento
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTipoAtendimento("domicilio")}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
              ehDomicilio ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <Home className={`h-8 w-8 ${ehDomicilio ? "text-brand-600" : "text-slate-400"}`} />
            <div>
              <p className="font-semibold text-slate-900">{TIPO_ATENDIMENTO_LABEL.domicilio}</p>
              <p className="text-xs text-slate-500">Visita no cliente — agenda e técnico obrigatórios</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setTipoAtendimento("oficina")}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
              !ehDomicilio ? "border-slate-600 bg-slate-100" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <Wrench className={`h-8 w-8 ${!ehDomicilio ? "text-slate-700" : "text-slate-400"}`} />
            <div>
              <p className="font-semibold text-slate-900">{TIPO_ATENDIMENTO_LABEL.oficina}</p>
              <p className="text-xs text-slate-500">Equipamento na bancada — aparece no painel da oficina</p>
            </div>
          </button>
        </div>
      </div>

      {/* ====================== CLIENTE ====================== */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Cliente
          </h3>
          {!modoEdicao && (
            <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => { setModoCliente("existente"); }}
                className={`rounded-md px-3 py-1 ${modoCliente === "existente" ? "bg-brand-600 text-white" : "text-slate-600"}`}
              >
                Existente
              </button>
              <button
                type="button"
                onClick={() => { setModoCliente("novo"); setCliente(null); }}
                className={`rounded-md px-3 py-1 ${modoCliente === "novo" ? "bg-brand-600 text-white" : "text-slate-600"}`}
              >
                Novo cliente
              </button>
            </div>
          )}
        </div>

        {modoCliente === "existente" ? (
          cliente ? (
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-brand-600" />
                <div>
                  <p className="font-medium text-slate-900">{cliente.nome}</p>
                  {cliente.telefone && (
                    <p className="text-xs text-slate-500">{formatTelefone(cliente.telefone)}</p>
                  )}
                </div>
              </div>
              {!modoEdicao && (
                <button type="button" onClick={() => setCliente(null)} className="text-slate-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar cliente por nome, telefone ou CPF..."
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
                {buscando && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
              {resultados.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {resultados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selecionarCliente(c)}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium">{c.nome}</span>
                        <span className="text-xs text-slate-500">
                          {c.telefone ? formatTelefone(c.telefone) : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <label className="label">Nome *</label>
              <input className="input" value={novoCli.nome}
                onChange={(e) => setNovoCli({ ...novoCli, nome: e.target.value })} required={modoCliente === "novo"} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">CPF/CNPJ</label>
              <input className="input" value={novoCli.cpf_cnpj}
                onChange={(e) => setNovoCli({ ...novoCli, cpf_cnpj: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Telefone / WhatsApp</label>
              <input className="input" value={novoCli.telefone}
                onChange={(e) => setNovoCli({ ...novoCli, telefone: e.target.value })} placeholder="(51) 99999-9999" />
            </div>
            <div className="sm:col-span-3">
              <label className="label">E-mail</label>
              <input className="input" value={novoCli.email}
                onChange={(e) => setNovoCli({ ...novoCli, email: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">CEP</label>
              <div className="flex gap-2">
                <input className="input" value={novoCli.cep}
                  onChange={(e) => setNovoCli({ ...novoCli, cep: e.target.value })}
                  onBlur={() => novoCli.cep && handleBuscarCep()} placeholder="00000-000" />
                <button type="button" onClick={handleBuscarCep} className="btn-secondary shrink-0" disabled={buscandoCep}>
                  {buscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="sm:col-span-3">
              <label className="label">Logradouro</label>
              <input className="input" value={novoCli.logradouro}
                onChange={(e) => setNovoCli({ ...novoCli, logradouro: e.target.value })} />
            </div>
            <div className="sm:col-span-1">
              <label className="label">Número</label>
              <input className="input" value={novoCli.numero}
                onChange={(e) => setNovoCli({ ...novoCli, numero: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Bairro</label>
              <input className="input" value={novoCli.bairro}
                onChange={(e) => setNovoCli({ ...novoCli, bairro: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Complemento</label>
              <input className="input" value={novoCli.complemento}
                onChange={(e) => setNovoCli({ ...novoCli, complemento: e.target.value })} />
            </div>
            <div className="sm:col-span-1">
              <label className="label">Cidade</label>
              <input className="input" value={novoCli.cidade}
                onChange={(e) => setNovoCli({ ...novoCli, cidade: e.target.value })} />
            </div>
            <div className="sm:col-span-1">
              <label className="label">UF</label>
              <select className="input" value={novoCli.uf}
                onChange={(e) => setNovoCli({ ...novoCli, uf: e.target.value })}>
                <option value="">-</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <p className="sm:col-span-6 text-xs text-slate-400">
              O cliente será gravado automaticamente ao salvar a OS.
            </p>
          </div>
        )}
      </div>

      {/* ====================== EQUIPAMENTOS ====================== */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Equipamentos
          </h3>
          <button type="button" onClick={addEquipSlot} className="btn-secondary text-sm">
            <Plus className="h-4 w-4" /> Adicionar equipamento
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Você pode vincular mais de um aparelho na mesma ordem de serviço.
        </p>
        <div className="space-y-4">
          {equipSlots.map((slot, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Equipamento {idx + 1}
                </span>
                {equipSlots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => rmEquipSlot(idx)}
                    className="text-slate-400 hover:text-red-500"
                    title="Remover equipamento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {equipExistentes.length > 0 && (
                <div className="mb-3">
                  <label className="label">Selecionar cadastrado do cliente</label>
                  <select
                    className="input"
                    value={slot.id}
                    onChange={(e) => selecionarEquipExistente(idx, e.target.value)}
                  >
                    <option value="">+ Cadastrar novo equipamento</option>
                    {equipExistentes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.tipo} {e.marca ? `- ${e.marca}` : ""} {e.modelo ?? ""}{" "}
                        {e.numero_serie ? `(${e.numero_serie})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!slot.id && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <label className="label">Tipo *</label>
                    <SpellCheckInput
                      inline
                      list="tipos-equip"
                      value={slot.tipo}
                      onChange={(e) => updEquipSlot(idx, { tipo: e.target.value })}
                      placeholder="Ex: Geladeira"
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Marca</label>
                    <SpellCheckInput
                      inline
                      value={slot.marca}
                      onChange={(e) => updEquipSlot(idx, { marca: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Modelo</label>
                    <SpellCheckInput
                      inline
                      value={slot.modelo}
                      onChange={(e) => updEquipSlot(idx, { modelo: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Nº de série</label>
                    <input
                      className="input"
                      value={slot.serie}
                      onChange={(e) => updEquipSlot(idx, { serie: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Voltagem</label>
                    <select
                      className="input"
                      value={slot.voltagem}
                      onChange={(e) => updEquipSlot(idx, { voltagem: e.target.value })}
                    >
                      <option value="">-</option>
                      <option>110V</option>
                      <option>220V</option>
                      <option>Bivolt</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Cor</label>
                    <SpellCheckInput
                      inline
                      value={slot.cor}
                      onChange={(e) => updEquipSlot(idx, { cor: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              )}
              {slot.id && (
                <p className="text-sm text-slate-700">
                  <strong>{slot.tipo}</strong>
                  {slot.marca && ` — ${slot.marca}`} {slot.modelo}
                  {slot.serie && ` • Série: ${slot.serie}`}
                  {slot.voltagem && ` • ${slot.voltagem}`}
                </p>
              )}
            </div>
          ))}
        </div>
        <datalist id="tipos-equip">
          {["Geladeira","Freezer","Fogão","Cooktop","Forno","Micro-ondas","Máquina de Lavar",
            "Lava e Seca","Lava-louças","Secadora","Ar-condicionado","Adega","Lavadora de Alta Pressão",
            "Aspirador","Bebedouro","Purificador","Ventilador","Cafeteira"].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>

      {/* ====================== ATENDIMENTO ====================== */}
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Atendimento
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <label className="label">Defeito relatado pelo cliente</label>
            <SpellCheckTextarea name="defeito_relatado" defaultValue={ordem?.defeito_relatado || ""} />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Acessórios / o que acompanha</label>
            <SpellCheckInput inline name="acompanha" defaultValue={ordem?.acompanha || ""} className="input" />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Estado / avarias do aparelho</label>
            <SpellCheckInput inline name="estado_aparelho" defaultValue={ordem?.estado_aparelho || ""} className="input" />
          </div>
          <div className="sm:col-span-6">
            <label className="label">Diagnóstico / laudo técnico</label>
            <SpellCheckTextarea name="diagnostico" defaultValue={ordem?.diagnostico || ""} />
          </div>
          <div className="sm:col-span-6">
            <label className="label">Serviço executado</label>
            <SpellCheckTextarea name="servico_executado" defaultValue={ordem?.servico_executado || ""} />
          </div>
        </div>
      </div>

      {/* ====================== ITENS ====================== */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Serviços e peças
          </h3>
          <div className="flex items-center gap-2">
            {catalogo.length > 0 && (
              <select
                className="input max-w-[220px] text-sm"
                value=""
                onChange={(e) => { addDoCatalogo(e.target.value); e.target.value = ""; }}
              >
                <option value="">+ Do catálogo...</option>
                {catalogo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao} — {formatCurrency(c.valor)}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={addItem} className="btn-secondary text-sm">
              <Plus className="h-4 w-4" /> Adicionar item
            </button>
          </div>
        </div>
        <div className="mb-1 hidden grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-400 sm:grid">
          <span className="col-span-2">Tipo</span>
          <span className="col-span-4">Descrição</span>
          <span className="col-span-1">Qtd</span>
          <span className="col-span-2">Custo unit.</span>
          <span className="col-span-2">Venda unit.</span>
          <span className="col-span-1"></span>
        </div>
        <div className="space-y-2">
          {itens.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <select className="input col-span-3 sm:col-span-2" value={item.tipo}
                onChange={(e) => updItem(idx, { tipo: e.target.value as "servico" | "peca" })}>
                <option value="servico">Serviço</option>
                <option value="peca">Peça</option>
              </select>
              <input className="input col-span-9 sm:col-span-4" placeholder="Descrição"
                spellCheck lang="pt-BR" autoCorrect="on"
                value={item.descricao} onChange={(e) => updItem(idx, { descricao: e.target.value })} />
              <input type="number" min="0" step="0.01" className="input col-span-3 sm:col-span-1" placeholder="Qtd"
                value={item.quantidade} onChange={(e) => updItem(idx, { quantidade: Number(e.target.value) })} />
              <input type="number" min="0" step="0.01" className="input col-span-4 sm:col-span-2" placeholder="Custo"
                title="Custo que você pagou (peça/serviço)"
                value={item.custo_unitario} onChange={(e) => updItem(idx, { custo_unitario: parseMoneyInput(e.target.value) })} />
              <input type="number" min="0" step="0.01" className="input col-span-4 sm:col-span-2" placeholder="Venda"
                title="Valor cobrado do cliente"
                value={item.valor_unitario} onChange={(e) => updItem(idx, { valor_unitario: parseMoneyInput(e.target.value) })} />
              <button type="button" onClick={() => rmItem(idx)}
                className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {ehDomicilio && (
        <div className="card border-brand-100 bg-brand-50/30 p-5">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Visita na agenda do técnico
          </h3>
          <p className="mb-4 text-xs text-slate-500">
            Ao salvar a OS, a visita entra automaticamente na agenda do técnico selecionado.
            {modoEdicao && " Alterar data, turno ou técnico atualiza a agenda."}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Data da visita *</label>
              <input
                type="date"
                name="data_previsao"
                className="input"
                required={ehDomicilio}
                defaultValue={ordem?.data_previsao || hojeYmdLocal()}
              />
            </div>
            <div>
              <label className="label">Turno *</label>
              <select name="turno" className="input" defaultValue={ordem?.turno || "manha"} required={ehDomicilio}>
                <option value="manha">Manhã (09:00–12:00)</option>
                <option value="tarde">Tarde (13:00–17:30)</option>
                <option value="dia">Dia inteiro</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ====================== VALORES / FECHAMENTO ====================== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Condições
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {tecnicoFixo ? (
              <>
                <input type="hidden" name="tecnico_id" value={tecnicoIdPadrao || ordem?.tecnico_id || ""} />
                <input type="hidden" name="tecnico" value={tecnicoPadrao || ordem?.tecnico || ""} />
              </>
            ) : (
              <div className="sm:col-span-4">
                <label className="label">
                  {ehDomicilio ? "Técnico responsável *" : "Responsável na oficina (opcional)"}
                </label>
                <select
                  name="tecnico_id"
                  className="input"
                  required={ehDomicilio}
                  value={tecnicoSelecionado}
                  onChange={(e) => setTecnicoSelecionado(e.target.value)}
                >
                  <option value="">Selecione o técnico cadastrado...</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}{t.email ? ` (${t.email})` : ""}
                    </option>
                  ))}
                </select>
                {tecnicos.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    Nenhum técnico cadastrado. Crie em Usuários com papel Técnico.
                  </p>
                )}
                {ehDomicilio && <TecnicoCargaTrabalho tecnicoId={tecnicoSelecionado} />}
              </div>
            )}
            <div>
              <label className="label">Prioridade</label>
              <select name="prioridade" className="input" defaultValue={ordem?.prioridade || "normal"}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="label">Garantia (dias)</label>
              <input type="number" name="garantia_dias" className="input"
                defaultValue={ordem?.garantia_dias ?? 90} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Forma de pagamento</label>
              <select name="forma_pagamento" className="input" defaultValue={ordem?.forma_pagamento || ""}>
                <option value="">-</option>
                <option>Dinheiro</option>
                <option>PIX</option>
                <option>Cartão de débito</option>
                <option>Cartão de crédito</option>
                <option>Boleto</option>
                <option>Transferência</option>
              </select>
            </div>
            {!modoEdicao && (
              <div className="sm:col-span-2">
                <label className="label">Status inicial</label>
                <select
                  name="status"
                  className="input"
                  defaultValue={ehDomicilio ? "em_roteiro" : "em_analise"}
                >
                  {ehDomicilio ? (
                    <>
                      <option value="em_roteiro">Em roteiro (visita agendada)</option>
                      <option value="aberta">Aberta</option>
                      <option value="em_analise">Em análise</option>
                    </>
                  ) : (
                    <>
                      <option value="em_analise">Em análise</option>
                      <option value="aberta">Aberta</option>
                      <option value="aguardando_aprovacao">Aguardando aprovação</option>
                    </>
                  )}
                </select>
              </div>
            )}
            <div className="sm:col-span-4">
              <label className="label">Observações</label>
              <SpellCheckTextarea name="observacoes" defaultValue={ordem?.observacoes || ""} />
            </div>
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Resumo
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Serviços + peças</span>
              <span className="font-medium">{formatCurrency(valorItens)}</span>
            </div>

            <div className={ehDomicilio ? "" : "hidden"}>
              <label className="label">Visita técnica (R$)</label>
              <input type="number" name="valor_visita" min="0" step="0.01" className="input"
                value={ehDomicilio ? valorVisita : ""} onChange={(e) => setValorVisita(parseMoneyInput(e.target.value))} />
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={abaterVisita}
                  onChange={(e) => setAbaterVisita(e.target.checked)} />
                Abater visita do total do serviço
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Desconto</label>
                <input type="number" name="desconto" min="0" step="0.01" className="input"
                  value={desconto} onChange={(e) => setDesconto(parseMoneyInput(e.target.value))} />
              </div>
              <div>
                <label className="label">Acréscimo</label>
                <input type="number" name="acrescimo" min="0" step="0.01" className="input"
                  value={acrescimo} onChange={(e) => setAcrescimo(parseMoneyInput(e.target.value))} />
              </div>
            </div>

            {moneyToNum(valorVisita) > 0 && (
              <div className={`flex items-center justify-between text-xs ${abaterVisita ? "text-amber-600" : "text-slate-600"}`}>
                <span>{abaterVisita ? "Visita abatida" : "Visita cobrada no total"}</span>
                <span>{abaterVisita ? "- " : "+ "}{formatCurrency(moneyToNum(valorVisita))}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold text-slate-900">Total (cliente)</span>
              <span className="text-xl font-bold text-brand-700">{formatCurrency(totalGeral)}</span>
            </div>

            <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Custo total (peças/serviços)</span>
                <span>{formatCurrency(custoItens)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-700">Lucro líquido</span>
                <span className={lucro >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(lucro)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {modoEdicao ? "Salvar alterações" : "Abrir ordem de serviço"}
        </button>
      </div>
    </form>
  );
}
