"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AppProvider, useApp } from "@/context/AppContext";
import { AuthProvider } from "@/context/AuthContext";
import { useEquipment } from "@/lib/hooks/useEquipment";
import { EquipmentModalHost } from "@/lib/hooks/useEquipmentModal";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { ToastProvider } from "@/components/ui/Toast";
import { ShortcutsHelp, NAV_SHORTCUTS } from "@/components/layout/ShortcutsHelp";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { AutocompleteLists } from "@/components/equipment/AutocompleteLists";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { darkMode, refreshRef, compactMode } = useApp();
  const router = useRouter();
  const hydrated = useHydrated();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    // Two search boxes exist (desktop row / mobile row); focus the one that is laid out.
    const focusSearch = () => {
      const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('[aria-label="Buscar en el dashboard"]'));
      boxes.find((b) => b.offsetParent !== null)?.focus();
    };
    const handler = (e: KeyboardEvent) => {
      const isTyping = ["INPUT", "TEXTAREA"].includes(
        (e.target as HTMLElement).tagName,
      );
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        focusSearch();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        refreshRef.current?.();
      }
      if (e.key === "Escape") setMobileOpen(false);
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        focusSearch();
      }
      // Legacy Ctrl+1..9 navigation and Ctrl+? help.
      if (e.ctrlKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const target = NAV_SHORTCUTS[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          router.push(target);
        }
      }
      if (e.key === "?" && (e.ctrlKey || (!isTyping && e.shiftKey))) {
        e.preventDefault();
        setHelpOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [refreshRef, router]);

  useEquipment();

  return (
    <div className="broki-shell">
      <PwaRegister scope="dashboard" />
      <aside className="broki-shell__sidebar">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <>
          <div
            className="broki-shell__overlay md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="broki-shell__sidebar broki-shell__sidebar--mobile md:hidden">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="broki-shell__main">
        <Topbar onMenuToggle={() => setMobileOpen((o) => !o)} />
        <main className={`broki-shell__content broki-scrollbar${hydrated && compactMode ? " compact-view" : ""}`}>
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <EquipmentModalHost />
      </Suspense>
      <AutocompleteLists />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <DashboardShell>{children}</DashboardShell>
        </ToastProvider>
      </AppProvider>
    </AuthProvider>
  );
}
