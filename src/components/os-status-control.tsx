"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { STATUS_OS_LABEL } from "@/lib/format";

export function OsStatusControl({
  statusAtual,
  action,
}: {
  statusAtual: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [status, setStatus] = useState(statusAtual);
  const [obs, setObs] = useState("");
  const [pending, startTransition] = useTransition();

  function handle() {
    const fd = new FormData();
    fd.set("status", status);
    fd.set("observacao", obs);
    startTransition(async () => {
      await action(fd);
      setObs("");
    });
  }

  return (
    <div className="space-y-2">
      <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
        {Object.entries(STATUS_OS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
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
