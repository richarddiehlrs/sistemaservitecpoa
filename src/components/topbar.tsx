"use client";

import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, QrCode } from "lucide-react";
import { temPermissao, type Papel } from "@/lib/permissoes";
import { GlobalSearch } from "./global-search";
import { Notifications } from "./notifications";

export function Topbar({
  collapsed,
  onToggleSidebar,
  onOpenMobile,
  papel,
  userId,
  userNome,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  papel?: Papel;
  userId?: string;
  userNome?: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur sm:px-5">
      <button
        onClick={onOpenMobile}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        title="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        onClick={onToggleSidebar}
        className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:inline-flex"
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1">
        {papel && temPermissao(papel, "ordens") && (
          <Link
            href="/escanear"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
            title="Escanear QR da OS"
          >
            <QrCode className="h-5 w-5" />
          </Link>
        )}
        <Notifications papel={papel} userId={userId} userNome={userNome} />
      </div>
    </header>
  );
}
