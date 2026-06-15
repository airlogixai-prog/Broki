"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AppProvider, useApp } from "@/context/AppContext";
import { AuthProvider } from "@/context/AuthContext";
import { useEquipment } from "@/lib/hooks/useEquipment";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { darkMode, theme } = useApp();

  // Sync dark mode + theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    if (theme !== "default") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [darkMode, theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isTyping = ["INPUT", "TEXTAREA"].includes(
        (e.target as HTMLElement).tagName
      );
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[placeholder*="Buscar"]')?.focus();
      }
      if (e.key === "Escape") {
        document
          .querySelectorAll<HTMLDialogElement>("dialog[open]")
          .forEach((d) => d.close());
      }
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[placeholder*="Buscar"]')?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Data fetching
  useEquipment();

  return (
    <div className="flex h-full min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-72 fixed inset-y-0 z-40">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 md:hidden flex flex-col shadow-xl">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:pl-72 min-h-screen">
        <Topbar onMenuToggle={() => setMobileOpen((o) => !o)} />
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
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
        <DashboardShell>{children}</DashboardShell>
      </AppProvider>
    </AuthProvider>
  );
}
