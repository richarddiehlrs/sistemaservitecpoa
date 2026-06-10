"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import type { Cliente } from "@/types/database";
import { buscarCep } from "@/lib/cep";
import { formatCep, formatCpfCnpj, formatTelefone, maskCpfCnpj, maskTelefone, maskCep, onlyDigits } from "@/lib/format";
import { validarCpfCnpj } from "@/lib/validators";

type Props = {
  cliente?: Cliente;
  action: (formData: FormData) => Promise<void>;
};

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function ClienteForm({ cliente, action }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepErro, setCepErro] = useState<string | null>(null);

  const [doc, setDoc] = useState(cliente?.cpf_cnpj ? formatCpfCnpj(cliente.cpf_cnpj) : "");
  const [tel, setTel] = useState(cliente?.telefone ? formatTelefone(cliente.telefone) : "");
  const [tel2, setTel2] = useState(cliente?.telefone2 ? formatTelefone(cliente.telefone2) : "");
  const docDigits = onlyDigits(doc);
  const docInvalido = docDigits.length > 0 && (docDigits.length === 11 || docDigits.length === 14) && !validarCpfCnpj(doc);

  const [endereco, setEndereco] = useState({
    cep: cliente?.cep ? formatCep(cliente.cep) : "",
    logradouro: cliente?.logradouro || "",
    bairro: cliente?.bairro || "",
    cidade: cliente?.cidade || "",
    uf: cliente?.uf || "",
    complemento: cliente?.complemento || "",
  });

  async function handleBuscarCep() {
    setCepErro(null);
    setBuscandoCep(true);
    const res = await buscarCep(endereco.cep);
    setBuscandoCep(false);
    if (!res) {
      setCepErro("CEP não encontrado.");
      return;
    }
    setEndereco((e) => ({
      ...e,
      logradouro: res.logradouro || e.logradouro,
      bairro: res.bairro || e.bairro,
      cidade: res.cidade || e.cidade,
      uf: res.uf || e.uf,
      complemento: res.complemento || e.complemento,
    }));
    document.getElementById("numero")?.focus();
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await action(formData);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Dados principais */}
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dados do cliente
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="label">Tipo</label>
            <select name="tipo" defaultValue={cliente?.tipo || "PF"} className="input">
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
            </select>
          </div>
          <div className="sm:col-span-4">
            <label className="label">Nome / Razão social *</label>
            <input name="nome" required defaultValue={cliente?.nome || ""} className="input" />
          </div>

          <div className="sm:col-span-3">
            <label className="label">CPF / CNPJ</label>
            <input
              name="cpf_cnpj"
              value={doc}
              onChange={(e) => setDoc(maskCpfCnpj(e.target.value))}
              className={`input ${docInvalido ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
            {docInvalido && <p className="mt-1 text-xs text-red-600">CPF/CNPJ inválido. Confira os números.</p>}
          </div>
          <div className="sm:col-span-3">
            <label className="label">RG / Inscrição estadual</label>
            <input name="rg_ie" defaultValue={cliente?.rg_ie || ""} className="input" />
          </div>

          <div className="sm:col-span-3">
            <label className="label">Telefone / WhatsApp</label>
            <input
              name="telefone"
              value={tel}
              onChange={(e) => setTel(maskTelefone(e.target.value))}
              className="input"
              placeholder="(51) 99999-9999"
              inputMode="numeric"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Telefone 2</label>
            <input
              name="telefone2"
              value={tel2}
              onChange={(e) => setTel2(maskTelefone(e.target.value))}
              className="input"
              placeholder="(51) 3000-0000"
              inputMode="numeric"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="label">E-mail</label>
            <input name="email" type="email" defaultValue={cliente?.email || ""} className="input" />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Endereço
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="label">CEP</label>
            <div className="flex gap-2">
              <input
                name="cep"
                value={endereco.cep}
                onChange={(e) => setEndereco({ ...endereco, cep: maskCep(e.target.value) })}
                onBlur={() => endereco.cep && handleBuscarCep()}
                className="input"
                placeholder="00000-000"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={handleBuscarCep}
                className="btn-secondary shrink-0"
                disabled={buscandoCep}
                title="Buscar endereço pelo CEP"
              >
                {buscandoCep ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </div>
            {cepErro && <p className="mt-1 text-xs text-red-600">{cepErro}</p>}
          </div>

          <div className="sm:col-span-3">
            <label className="label">Logradouro</label>
            <input
              name="logradouro"
              value={endereco.logradouro}
              onChange={(e) => setEndereco({ ...endereco, logradouro: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Número</label>
            <input id="numero" name="numero" defaultValue={cliente?.numero || ""} className="input" />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Complemento</label>
            <input
              name="complemento"
              value={endereco.complemento}
              onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Bairro</label>
            <input
              name="bairro"
              value={endereco.bairro}
              onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="label">Cidade</label>
            <input
              name="cidade"
              value={endereco.cidade}
              onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="label">UF</label>
            <select
              name="uf"
              value={endereco.uf}
              onChange={(e) => setEndereco({ ...endereco, uf: e.target.value })}
              className="input"
            >
              <option value="">-</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-6">
            <label className="label">Ponto de referência</label>
            <input
              name="ponto_referencia"
              defaultValue={cliente?.ponto_referencia || ""}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Observações */}
      <div className="card p-5">
        <label className="label">Observações</label>
        <textarea
          name="observacoes"
          rows={3}
          defaultValue={cliente?.observacoes || ""}
          className="input"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {cliente ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
      </div>
    </form>
  );
}
