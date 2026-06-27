"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-card-hover">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Algo deu errado</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ocorreu um erro ao carregar esta tela. Você pode tentar novamente ou voltar ao início.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-slate-400">
            Código do erro: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-2">
          <button onClick={reset} className="btn-primary">
            <RotateCcw className="h-4 w-4" /> Tentar novamente
          </button>
          <Link href="/" className="btn-secondary">
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
