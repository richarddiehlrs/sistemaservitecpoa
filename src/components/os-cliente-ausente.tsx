"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, ImagePlus, UserX, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "./toast";

export function OsClienteAusente({
  osId,
  assinaturaTecnico,
  observacaoAtual,
  action,
}: {
  osId: string;
  assinaturaTecnico?: string | null;
  observacaoAtual?: string | null;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [obs, setObs] = useState(observacaoAtual || "");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const supabase = createClient();

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${osId}/ausente-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("os-fotos").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("os-fotos").getPublicUrl(path);
      setFotoUrl(data.publicUrl);
      setFotoPath(path);
    } catch (err) {
      toast.push((err as Error).message || "Erro ao enviar foto.", "error");
    } finally {
      setEnviandoFoto(false);
      e.target.value = "";
    }
  }

  function registrar() {
    if (!assinaturaTecnico) {
      toast.push("Assine a ordem de serviço na seção acima antes de registrar cliente ausente.", "error");
      return;
    }
    if (!fotoUrl) {
      toast.push("Tire uma foto do local/equipamento (cliente ausente).", "error");
      return;
    }
    const fd = new FormData();
    fd.set("observacao", obs);
    fd.set("foto_url", fotoUrl);
    fd.set("foto_path", fotoPath || "");
    start(async () => {
      const res = await action(fd);
      if (!res.ok) {
        toast.push(res.error || "Erro ao registrar.", "error");
        return;
      }
      toast.push("Cliente ausente registrado com sucesso.", "success");
    });
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-amber-800">
        <UserX className="h-4 w-4" />
        Registre foto e observação quando o cliente não estiver presente.
      </p>

      {!assinaturaTecnico ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O técnico deve <strong>assinar a ordem de serviço</strong> na seção &quot;Assinatura do técnico&quot; antes de registrar cliente ausente.
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-700">
          ✓ Assinatura do técnico já registrada nesta OS.
        </div>
      )}

      <div>
        <label className="label">Foto comprobatória *</label>
        <label className="btn-secondary inline-flex cursor-pointer text-sm">
          {enviandoFoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Tirar / enviar foto
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
        </label>
        {fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt="Foto cliente ausente" className="mt-2 h-32 rounded-lg border object-cover" />
        )}
      </div>

      <div>
        <label className="label">Observação</label>
        <textarea
          className="input"
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Ex: Cliente não atendeu, equipamento deixado na portaria..."
        />
      </div>

      <button
        type="button"
        onClick={registrar}
        disabled={pending || !assinaturaTecnico}
        className="btn-primary w-full"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        <Check className="h-4 w-4" />
        Registrar cliente ausente
      </button>
    </div>
  );
}
