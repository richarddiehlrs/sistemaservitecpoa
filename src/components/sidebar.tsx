"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Wrench,
  DollarSign,
  BarChart3,
  CalendarDays,
  PieChart,
  BookText,
  Settings,
  UserCog,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const GRUPOS: { titulo: string; itens: NavItem[] }[] = [
  {
    titulo: "Operação",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/ordens", label: "Ordens de Serviço", icon: Wrench },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { href: "/financeiro", label: "Financeiro", icon: DollarSign },
      { href: "/relatorios", label: "Relatórios", icon: PieChart },
      { href: "/dre", label: "DRE", icon: BarChart3 },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { href: "/catalogo", label: "Catálogo", icon: BookText },
      { href: "/usuarios", label: "Usuários", icon: UserCog, adminOnly: true },
      { href: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
    ],
  },
];

export function Sidebar({
  userEmail,
  role = "admin",
}: {
  userEmail?: string | null;
  role?: string;
}) {
  const pathname = usePathname();
  const iniciais = (userEmail || "U").slice(0, 2).toUpperCase();

  return (
    <aside className="flex h-screen w-64 flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300">
      {/* Marca */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-900/40">
          S
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">ServitecPoa</p>
          <p className="text-[11px] text-slate-400">ERP Assistência Técnica</p>
        </div>
      </div>

      <div className="mx-5 mb-2 h-px bg-white/10" />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {GRUPOS.map((grupo) => {
          const itens = grupo.itens.filter((i) => !i.adminOnly || role === "admin");
          if (itens.length === 0) return null;
          return (
            <div key={grupo.titulo}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {grupo.titulo}
              </p>
              <div className="space-y-0.5">
                {itens.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "bg-white/10 text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-400" />
                      )}
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Usuário */}
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-white/15">
            {iniciais}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-200">
              {userEmail || "Usuário"}
            </p>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-300">
              {role === "admin" ? "Administrador" : "Operador"}
            </span>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
