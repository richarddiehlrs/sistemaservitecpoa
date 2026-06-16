import { cn } from "@/lib/utils";

/** Badge visual para OS de retorno em garantia. */
export function MotivoOsBadge({
  motivo,
  className,
}: {
  motivo?: string | null;
  className?: string;
}) {
  if (motivo !== "retorno_garantia") return null;
  return (
    <span
      className={cn(
        "ml-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800",
        className
      )}
    >
      Retorno garantia
    </span>
  );
}
