"use client";

import { useState, useTransition } from "react";
import { Shield, Loader2 } from "lucide-react";
import { hojeYmdLocal } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "@/components/toast";

export function AbrirRetornoGarantia({
  osId,
  action,
  fimGarantiaLabel,
}: {
  osId: string;
  action: (osId: string, formData: FormData) => Promise<ActionResult>;
  fimGarantiaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const hoje = hojeYmdLocal();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await action(osId, fd);
        if (!res.ok) {
          toast.push(res.error || "Erro ao abrir retorno.", "error");
          return;
        }
        setOpen(false);
      } catch (err) {
        const digest = (err as { digest?: string })?.digest;
        if (
          typeof digest === "string" &&
          (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))
        ) {
          throw err;
        }
        toast.push(err instanceof Error ? err.message : "Erro ao abrir retorno.", "error");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        <Shield className="h-4 w-4" /> Abrir retorno em garantia
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-800">Retorno em garantia</p>
      <p className="text-xs text-slate-500">
        Cria uma nova OS vinculada à original. Garantia válida até {fimGarantiaLabel}. O custo entra
        como prejuízo; você informa o pagamento ao concluir.
      </p>
      <div>
        <label className="label">Problema relatado</label>
        <textarea name="defeito_relatado" rows={2} className="input text-sm" placeholder="Ex.: mesmo defeito voltou" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Data visita</label>
          <input type="date" name="data_previsao" className="input text-sm" min={hoje} defaultValue={hoje} />
        </div>
        <div>
          <label className="label">Turno</label>
          <select name="turno" className="input text-sm" defaultValue="manha">
            <option value="manha">Manhã</option>
            <option value="tarde">Tarde</option>
            <option value="dia">Dia</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar retorno"}
        </button>
      </div>
    </form>
  );
}
