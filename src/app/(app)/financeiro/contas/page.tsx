import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/use-action";
import { FORMAS_PAGAMENTO } from "@/lib/formas-pagamento";
import type { ContaFinanceira } from "@/types/database";
import { salvarConta } from "../conciliacao/actions";

export const dynamic = "force-dynamic";

const TIPOS: { v: ContaFinanceira["tipo"]; l: string }[] = [
  { v: "banco", l: "Banco" },
  { v: "maquininha", l: "Maquininha / conta de pagamento" },
  { v: "caixa", l: "Caixa (dinheiro)" },
  { v: "outro", l: "Outro" },
];

export default async function ContasPage() {
  await requirePermissao("financeiro");
  const supabase = await createClient();
  const { data: contas } = await supabase.from("contas_financeiras").select("*").order("ativo", { ascending: false }).order("nome");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/financeiro/conciliacao" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Conciliação
      </Link>
      <PageHeader
        title="Contas financeiras"
        subtitle="Onde o dinheiro entra e sai. A forma de pagamento escolhe a conta automaticamente."
      />
      <div className="space-y-4">
        {(contas || []).map((c) => (
          <ContaForm key={c.id} conta={c} />
        ))}
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">+ Nova conta</summary>
          <div className="mt-3">
            <ContaForm />
          </div>
        </details>
      </div>
    </div>
  );
}

function ContaForm({ conta }: { conta?: ContaFinanceira }) {
  return (
    <ActionForm
      action={salvarConta}
      successMsg="Conta salva."
      resetOnSuccess={!conta}
      className={conta ? `card space-y-3 p-4 ${conta.ativo ? "" : "opacity-60"}` : "space-y-3"}
    >
      {conta && <input type="hidden" name="id" value={conta.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Nome</label>
          <input name="nome" className="input" defaultValue={conta?.nome} required />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select name="tipo" className="input" defaultValue={conta?.tipo ?? "banco"}>
            {TIPOS.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Situação</label>
          <select name="ativo" className="input" defaultValue={conta?.ativo === false ? "false" : "true"}>
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Banco</label>
          <input name="banco" className="input" defaultValue={conta?.banco ?? ""} placeholder="237" />
        </div>
        <div>
          <label className="label">Agência</label>
          <input name="agencia" className="input" defaultValue={conta?.agencia ?? ""} />
        </div>
        <div>
          <label className="label">Conta</label>
          <input name="numero" className="input" defaultValue={conta?.numero ?? ""} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Saldo inicial (R$)</label>
          <input name="saldo_inicial" type="number" step="0.01" className="input" defaultValue={Number(conta?.saldo_inicial ?? 0).toFixed(2)} />
        </div>
        <div>
          <label className="label">Saldo na data de</label>
          <input name="data_saldo_inicial" type="date" className="input" defaultValue={conta?.data_saldo_inicial ?? ""} />
        </div>
      </div>
      <div>
        <p className="label">Formas de pagamento que caem nesta conta</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {FORMAS_PAGAMENTO.map((f) => (
            <label key={f} className="inline-flex items-center gap-1.5">
              <input type="checkbox" name="formas_padrao" value={f} defaultChecked={conta?.formas_padrao?.includes(f)} />
              {f}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          O saldo inicial é o saldo do extrato no fim do dia informado; pagamentos a partir do dia seguinte somam a ele.
        </p>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary">Salvar</button>
      </div>
    </ActionForm>
  );
}
