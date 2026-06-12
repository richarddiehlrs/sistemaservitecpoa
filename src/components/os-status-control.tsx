"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { STATUS_OS_LABEL } from "@/lib/format";

export function OsStatusControl({
  statusAtual,
  action,
  transicoesPermitidas = [],
}: {
  statusAtual: string;
  action: (formData: FormData) => Promise<void>;
  transicoesPermitidas?: string[];
}) {
  const opcoes = transicoesPermitidas.length > 0 ? transicoesPermitidas : [statusAtual];
  const [status, setStatus] = useState(statusAtual);
  const [obs, setObs] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(statusAtual);
  }, [statusAtual]);

  function handle() {
    const fd = new FormData();
    fd.set("status", status);
    fd.set("observacao", obs);
    startTransition(async () => {
      await action(fd);
      setObs("");
    });
  }

  if (transicoesPermitidas.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nenhuma alteração de status disponível para seu perfil nesta etapa.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value={statusAtual}>{STATUS_OS_LABEL[statusAtual] ?? statusAtual} (atual)</option>
        {opcoes
          .filter((k) => k !== statusAtual)
          .map((k) => (
            <option key={k} value={k}>
              {STATUS_OS_LABEL[k] ?? k}
            </option>
          ))}
      </select>
      <input
        className="input"
        placeholder="Observação (opcional)"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
      />
      <button
        onClick={handle}
        disabled={pending || status === statusAtual}
        className="btn-primary w-full"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Atualizar status
      </button>
    </div>
  );
}
