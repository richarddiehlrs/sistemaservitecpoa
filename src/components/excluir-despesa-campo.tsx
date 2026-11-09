"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "./toast";

/** Exclui despesa de campo do dia (o banco valida: quem lançou, mesmo dia, não conciliada). */
export function ExcluirDespesaCampo({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function excluir() {
    if (!window.confirm("Excluir esta despesa? Ela sai do financeiro.")) return;
    start(async () => {
      const supabase = createClient();
      const { data: caminho, error } = await supabase.rpc("excluir_despesa_campo", { p_id: id });
      if (error) {
        toast.push(error.message, "error");
        return;
      }
      if (caminho) await supabase.storage.from("comprovantes").remove([caminho]);
      toast.push("Despesa excluída.", "success");
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={excluir} disabled={pending} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
