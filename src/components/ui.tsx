import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_OS_COLOR, STATUS_OS_LABEL } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/70 pb-5">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
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
  const valueTone: Record<string, string> = {
    default: "text-slate-900",
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-brand-600",
  };
  const chipTone: Record<string, string> = {
    default: "bg-slate-100 text-slate-500",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-brand-50 text-brand-600",
  };
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {icon && (
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", chipTone[tone])}>
            {icon}
          </span>
        )}
      </div>
      <p className={cn("mt-3 text-2xl font-bold tracking-tight", valueTone[tone])}>{value}</p>
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

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between border-b border-slate-200/70 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="card p-4">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
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
