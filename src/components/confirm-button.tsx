"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "./toast";

export function ConfirmButton({
  action,
  children,
  className = "btn-danger",
  title = "Confirmar exclusão",
  message = "Tem certeza que deseja excluir? Esta ação não pode ser desfeita.",
  confirmLabel = "Excluir",
  successMsg,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  title?: string;
  message?: string;
  confirmLabel?: string;
  successMsg?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function confirmar() {
    start(async () => {
      try {
        await action();
        if (successMsg) toast.push(successMsg, "success");
        setOpen(false);
      } catch (e: unknown) {
        const err = e as { digest?: string; message?: string };
        if (typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) {
          throw e; // deixa o redirect acontecer
        }
        toast.push(err?.message || "Erro ao executar a ação.", "error");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !pending && setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm animate-fade-in-up rounded-2xl bg-white p-6 shadow-card-hover">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={confirmar} disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
