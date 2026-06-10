import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_OS_COLOR, STATUS_OS_LABEL } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  title,
  value,
  hint,
  icon,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "green" | "red" | "amber" | "blue";
}) {
  const tones: Record<string, string> = {
    default: "text-slate-900",
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-brand-600",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-2xl font-bold", tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("badge", STATUS_OS_COLOR[status] || "bg-slate-100 text-slate-700")}>
      {STATUS_OS_LABEL[status] || status}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={variant === "primary" ? "btn-primary" : "btn-secondary"}
    >
      {children}
    </Link>
  );
}
