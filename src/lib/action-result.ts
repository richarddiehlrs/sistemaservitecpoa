// Padrão único para Server Actions seguras.
// Em produção o Next.js mascara a mensagem de erros LANÇADOS (throw) em Server
// Actions/Components ("An error occurred in the Server Components render...").
// Já valores RETORNADOS não são mascarados. Por isso toda action deve RETORNAR
// { ok, error } em vez de lançar — assim o usuário vê a causa real no toast.

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const NEXT_CONTROL_PREFIXES = ["NEXT_REDIRECT", "NEXT_NOT_FOUND"];

/** redirect()/notFound() funcionam lançando erros de controle — não capturar. */
export function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown })?.digest;
  return (
    typeof digest === "string" &&
    NEXT_CONTROL_PREFIXES.some((prefix) => digest.startsWith(prefix))
  );
}

export function actionOk<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/** Garante FormData em Server Actions chamadas via bind + cliente. */
export function assertFormData(v: unknown): FormData {
  if (v instanceof FormData) return v;
  throw new Error("Dados do formulário inválidos. Recarregue a página e tente novamente.");
}

/**
 * Executa o corpo de uma Server Action capturando exceções e devolvendo
 * { ok:false, error } com a mensagem real. Deixa redirect()/notFound() passar.
 */
export async function safeAction<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (isNextControlFlow(err)) throw err;
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Ocorreu um erro inesperado. Tente novamente.";
    return { ok: false, error: message };
  }
}
