"use client";

import { useState } from "react";
import { Bell, Loader2, Save } from "lucide-react";
import { salvarPreferenciasAlertas } from "@/app/(app)/configuracoes/alertas/actions";
import { useToast } from "@/components/toast";
import { PushAtivar } from "@/components/push-ativar";

export type PreferenciasAlertas = {
  push_ativo: boolean;
  os_nova: boolean;
  os_status: boolean;
  os_aprovada: boolean;
  cliente_ausente: boolean;
  despesa_campo: boolean;
  financeiro: boolean;
  oficina_parada: boolean;
  meta_faturamento: boolean;
  email_resumo: boolean;
  dias_oficina_parada: number;
};

function Toggle({
  name,
  label,
  desc,
  defaultChecked,
}: {
  name: string;
  label: string;
  desc: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 rounded border-slate-300" />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{desc}</span>
      </span>
    </label>
  );
}

export function PreferenciasAlertasForm({ prefs }: { prefs: PreferenciasAlertas }) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await salvarPreferenciasAlertas(new FormData(e.currentTarget));
      if (!res.ok) {
        toast.push(res.error || "Erro ao salvar.", "error");
        return;
      }
      toast.push("Preferências de alertas salvas.", "success");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PushAtivar />

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Bell className="h-5 w-5 text-brand-600" />
          <h2 className="font-semibold text-slate-900">Tipos de alerta</h2>
        </div>

        <Toggle
          name="push_ativo"
          label="Notificações push no celular"
          desc="Receber avisos mesmo com o app fechado (requer ativação acima)."
          defaultChecked={prefs.push_ativo}
        />
        <Toggle
          name="os_nova"
          label="Nova OS atribuída"
          desc="Quando uma ordem de serviço for atribuída a você."
          defaultChecked={prefs.os_nova}
        />
        <Toggle
          name="os_status"
          label="Mudança de status da OS"
          desc="Quando uma OS muda de etapa (roteiro, execução, conclusão, etc.)."
          defaultChecked={prefs.os_status ?? true}
        />
        <Toggle
          name="os_aprovada"
          label="Orçamento aprovado"
          desc="Cliente aprovou orçamento no portal."
          defaultChecked={prefs.os_aprovada}
        />
        <Toggle
          name="cliente_ausente"
          label="Cliente ausente"
          desc="Técnico registrou ausência do cliente na visita."
          defaultChecked={prefs.cliente_ausente}
        />
        <Toggle
          name="despesa_campo"
          label="Despesa de campo"
          desc="Técnico lançou despesa aguardando aprovação."
          defaultChecked={prefs.despesa_campo}
        />
        <Toggle
          name="financeiro"
          label="Financeiro"
          desc="Contas a receber e a pagar vencendo."
          defaultChecked={prefs.financeiro}
        />
        <Toggle
          name="oficina_parada"
          label="Oficina parada"
          desc="OS de oficina em análise ou aguardando peça por muitos dias."
          defaultChecked={prefs.oficina_parada}
        />
        <Toggle
          name="meta_faturamento"
          label="Meta de faturamento"
          desc="Alerta quando o faturamento do mês estiver abaixo da meta."
          defaultChecked={prefs.meta_faturamento}
        />
        <Toggle
          name="email_resumo"
          label="E-mail resumo diário"
          desc="Receber resumo por e-mail (requer RESEND_API_KEY no servidor)."
          defaultChecked={prefs.email_resumo}
        />

        <div>
          <label className="label">Dias para alerta de oficina parada</label>
          <input
            type="number"
            name="dias_oficina_parada"
            min={1}
            max={30}
            defaultValue={prefs.dias_oficina_parada}
            className="input max-w-[120px]"
          />
        </div>

        <button type="submit" disabled={salvando} className="btn-primary">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar preferências
        </button>
      </form>
    </div>
  );
}
