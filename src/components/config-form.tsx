"use client";

import { useState, useTransition } from "react";
import { Loader2, Upload, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EmpresaConfig } from "@/lib/config";

export function ConfigForm({
  config,
  action,
}: {
  config: EmpresaConfig;
  action: (formData: FormData) => Promise<void>;
}) {
  const supabase = createClient();
  const [pending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState(config.logo_url || "");
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [salvo, setSalvo] = useState(false);

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoLogo(true);
    const ext = file.name.split(".").pop();
    const path = `logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("empresa").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (!error) {
      const { data } = supabase.storage.from("empresa").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } else {
      alert("Erro ao enviar a logo: " + error.message);
    }
    setEnviandoLogo(false);
  }

  function handle(formData: FormData) {
    formData.set("logo_url", logoUrl);
    setSalvo(false);
    startTransition(async () => {
      await action(formData);
      setSalvo(true);
    });
  }

  return (
    <form action={handle} className="space-y-6">
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Identidade
        </h3>
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="shrink-0">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">Sem logo</span>
              )}
            </div>
            <label className="btn-secondary mt-2 w-32 cursor-pointer text-xs">
              {enviandoLogo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Enviar logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </label>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Nome / Razão social</label>
              <input name="nome" defaultValue={config.nome} className="input" />
            </div>
            <div>
              <label className="label">CNPJ</label>
              <input name="cnpj" defaultValue={config.cnpj} className="input" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input name="telefone" defaultValue={config.telefone} className="input" />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input name="email" defaultValue={config.email} className="input" />
            </div>
            <div>
              <label className="label">Cidade</label>
              <input name="cidade" defaultValue={config.cidade} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Endereço</label>
              <input name="endereco" defaultValue={config.endereco} className="input" />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Textos da OS
        </h3>
        <div className="space-y-4">
          <div>
            <label className="label">Termo de garantia (impresso na OS)</label>
            <textarea name="termo_garantia" rows={3} defaultValue={config.termo_garantia} className="input" />
          </div>
          <div>
            <label className="label">Política / observações da OS</label>
            <textarea name="politica_os" rows={3} defaultValue={config.politica_os} className="input" />
          </div>
          <div>
            <label className="label">Modelo de mensagem WhatsApp</label>
            <textarea name="msg_whatsapp" rows={2} defaultValue={config.msg_whatsapp} className="input" />
            <p className="mt-1 text-xs text-slate-400">
              Variáveis disponíveis: <code>{"{empresa}"}</code>, <code>{"{os}"}</code>,{" "}
              <code>{"{status}"}</code>, <code>{"{cliente}"}</code>, <code>{"{total}"}</code>.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Financeiro
        </h3>
        <div className="max-w-xs">
          <label className="label">Comissão do técnico (% sobre o lucro)</label>
          <input
            name="comissao_percent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={config.comissao_percent}
            className="input"
          />
          <p className="mt-1 text-xs text-slate-400">
            Usado no relatório de comissão por técnico.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {salvo && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="h-4 w-4" /> Salvo!
          </span>
        )}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar configurações
        </button>
      </div>
    </form>
  );
}
