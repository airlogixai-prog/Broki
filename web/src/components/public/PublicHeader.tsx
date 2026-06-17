"use client";

import Link from "next/link";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/soluciones", label: "Soluciones" },
  { href: "/integraciones", label: "Integraciones" },
  { href: "/sobre-nosotros", label: "Sobre Nosotros" },
  { href: "/contacto", label: "Contacto" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#172a45] bg-[#172a45]/60 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <img src="/images/logo_3.png" alt="AIRLOGIX AI" className="h-10 w-auto sm:h-12" />
          <span className="text-lg font-bold text-white sm:text-xl">AIRLOGIX AI</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-[#ccd6f6] hover:text-[#41ead4]">
              {item.label}
            </Link>
          ))}
          <Link
            href="/broki"
            className="rounded-full border border-[#41ead4] px-4 py-1.5 text-sm font-semibold text-[#41ead4] hover:bg-[#41ead4] hover:text-[#0d1b2a]"
          >
            BROKI
          </Link>
        </nav>

        <button
          className="md:hidden text-white"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menú"
        >
          ☰
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[#172a45] px-4 py-3 space-y-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-[#ccd6f6] hover:text-[#41ead4]"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/broki" onClick={() => setOpen(false)} className="block py-2 text-sm text-[#41ead4] font-semibold">
            BROKI
          </Link>
        </div>
      )}
    </header>
  );
}
