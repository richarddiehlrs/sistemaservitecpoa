"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast";
import type { ActionResult } from "@/lib/action-result";

function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown })?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))
  );
}

type RunOpts = {
  successMsg?: string;
  errorMsg?: string;
  onSuccess?: () => void;
  /** Default: true — chama router.refresh() ao concluir com sucesso. */
  refresh?: boolean;
};

/**
 * Executa uma Server Action que retorna ActionResult, exibindo a mensagem real
 * de erro em toast (sem mascaramento) em vez de quebrar a aplicação.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    opts: RunOpts = {}
  ): void {
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) {
          toast.push(res.error || opts.errorMsg || "Erro ao processar.", "error");
          return;
        }
        if (opts.successMsg) toast.push(opts.successMsg, "success");
        opts.onSuccess?.();
        if (opts.refresh !== false) router.refresh();
      } catch (err) {
        if (isNextControlFlow(err)) throw err;
        toast.push(
          opts.errorMsg || (err instanceof Error && err.message) || "Erro inesperado.",
          "error"
        );
      }
    });
  }

  return { run, pending };
}

type ActionFormProps = {
  action: (formData: FormData) => Promise<ActionResult>;
  successMsg?: string;
  errorMsg?: string;
  onSuccess?: () => void;
  resetOnSuccess?: boolean;
  refresh?: boolean;
  children: React.ReactNode;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">;

/**
 * <form> que chama uma Server Action (ActionResult) com tratamento de erro
 * padronizado. Substitui `<form action={serverAction}>` para que falhas
 * apareçam em toast em vez de quebrar.
 */
export function ActionForm({
  action,
  successMsg,
  errorMsg,
  onSuccess,
  resetOnSuccess,
  refresh,
  children,
  ...rest
}: ActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { run, pending } = useAction();

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => action(fd), {
          successMsg,
          errorMsg,
          refresh,
          onSuccess: () => {
            if (resetOnSuccess) formRef.current?.reset();
            onSuccess?.();
          },
        });
      }}
      {...rest}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
