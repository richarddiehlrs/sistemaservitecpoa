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
  LineChart,
  CalendarCog,
  BookText,
  Settings,
  UserCog,
  Trash2,
  LogOut,
  MapPin,
  LayoutGrid,
  QrCode,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { temPermissao, PAPEL_LABEL, type Papel, type Permissao } from "@/lib/permissoes";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm?: Permissao;
  perms?: Permissao[];
};

const GRUPOS: { titulo: string; itens: NavItem[] }[] = [
  {
    titulo: "Campo",
    itens: [{ href: "/campo", label: "Campo", icon: MapPin, perms: ["despesas_campo", "campo_central"] }],
  },
  {
    titulo: "Operação",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" },
      { href: "/painel", label: "Painel", icon: LayoutGrid, perm: "ordens" },
      { href: "/escanear", label: "Escanear OS", icon: QrCode, perm: "ordens" },
      { href: "/agenda", label: "Agenda", icon: CalendarDays, perm: "agenda" },
      { href: "/ordens", label: "Ordens de Serviço", icon: Wrench, perm: "ordens" },
      { href: "/clientes", label: "Clientes", icon: Users, perm: "clientes" },
      { href: "/configuracoes/alertas", label: "Alertas", icon: Bell },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { href: "/financeiro", label: "Financeiro", icon: DollarSign, perm: "financeiro" },
      { href: "/financeiro/fluxo", label: "Fluxo de caixa", icon: LineChart, perm: "financeiro_fluxo" },
      { href: "/financeiro/recorrentes", label: "Despesas fixas", icon: CalendarCog, perm: "financeiro_recorrentes" },
      { href: "/relatorios", label: "Relatórios", icon: PieChart, perm: "relatorios" },
      { href: "/dre", label: "DRE", icon: BarChart3, perm: "dre" },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { href: "/catalogo", label: "Catálogo", icon: BookText, perm: "catalogo" },
      { href: "/manutencao", label: "Manutenção", icon: Trash2, perm: "ordens_excluir" },
      { href: "/usuarios", label: "Usuários", icon: UserCog, perm: "usuarios" },
      { href: "/configuracoes", label: "Configurações", icon: Settings, perm: "configuracoes" },
    ],
  },
];

export function Sidebar({
  userEmail,
  role = "admin",
  collapsed = false,
  onNavigate,
}: {
  userEmail?: string | null;
  role?: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const papel = (role as Papel) || "admin";
  const iniciais = (userEmail || "U").slice(0, 2).toUpperCase();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300 transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className={cn("flex items-center gap-3 px-5 py-5", collapsed && "justify-center px-0")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-900/40">
          S
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold leading-tight text-white">ServitecPoa</p>
            <p className="text-[11px] text-slate-400">ERP Assistência Técnica</p>
          </div>
        )}
      </div>

      <div className="mx-5 mb-2 h-px bg-white/10" />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {GRUPOS.map((grupo) => {
          const itens = grupo.itens.filter((i) =>
            i.perms ? i.perms.some((p) => temPermissao(papel, p)) : i.perm ? temPermissao(papel, i.perm) : true
          );
          if (itens.length === 0) return null;
          return (
            <div key={grupo.titulo}>
              {!collapsed && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {grupo.titulo}
                </p>
              )}
              <div className="space-y-0.5">
                {itens.map((item) => {
                  const active =
                    pathname === item.href ||
                    (pathname.startsWith(item.href + "/") && item.href !== "/financeiro");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all",
                        collapsed ? "justify-center px-0" : "px-3",
                        active
                          ? "bg-white/10 text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-400" />
                      )}
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"
                        )}
                      />
                      {!collapsed && item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-white/15">
              {iniciais}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-200">{userEmail || "Usuário"}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-300">
                {PAPEL_LABEL[papel] || papel}
              </span>
            </div>
          </div>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            title="Sair"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300",
              collapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!collapsed && "Sair"}
          </button>
        </form>
      </div>
    </aside>
  );
}
