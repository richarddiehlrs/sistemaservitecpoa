"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, CalendarDays, QrCode, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const ITENS = [
  { href: "/campo", label: "Campo", icon: MapPin, match: (p: string) => p === "/campo" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, match: (p: string) => p.startsWith("/agenda") },
  { href: "/escanear", label: "Escanear", icon: QrCode, match: (p: string) => p.startsWith("/escanear") },
  { href: "/campo#alertas", label: "Alertas", icon: Bell, match: (p: string) => p === "/campo" },
] as const;

export function CampoNavMobile() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Navegação campo"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITENS.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-brand-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-brand-500")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
