"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ToastProvider } from "./toast";
import { RegisterSW } from "./register-sw";
import { RouteGuard } from "./route-guard";
import type { Papel } from "@/lib/permissoes";

export function AppShell({
  userEmail,
  role,
  children,
}: {
  userEmail?: string | null;
  role?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("sidebar-collapsed") === "1") {
      setCollapsed(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const novo = !c;
      if (typeof window !== "undefined") localStorage.setItem("sidebar-collapsed", novo ? "1" : "0");
      return novo;
    });
  }

  return (
    <ToastProvider>
      <RegisterSW />
      <Suspense fallback={null}>
        <RouteGuard role={(role as Papel) || "admin"} />
      </Suspense>
      <div className="flex h-screen overflow-hidden bg-[#f6f8fb]">
        {/* Sidebar desktop */}
        <div className="hidden lg:block">
          <Sidebar userEmail={userEmail} role={role} collapsed={collapsed} />
        </div>

        {/* Drawer mobile */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 h-full">
              <Sidebar userEmail={userEmail} role={role} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar collapsed={collapsed} onToggleSidebar={toggleCollapsed} onOpenMobile={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl animate-fade-in-up p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
