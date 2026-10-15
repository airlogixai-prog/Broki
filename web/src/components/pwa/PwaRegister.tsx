"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SW_VERSION = "broki-public-v1";

interface Props {
  /** marketing = public site; dashboard = /broki only */
  scope: "marketing" | "dashboard";
}

export function PwaRegister({ scope }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isBroki = pathname?.startsWith("/broki");
    if (scope === "marketing" && isBroki) return;
    if (scope === "dashboard" && !isBroki) return;

    void navigator.serviceWorker
      .register(`/sw.js?${SW_VERSION}`, { scope: scope === "dashboard" ? "/broki" : "/" })
      .catch(() => {
        // ponytail: SW optional; app works without it
      });
  }, [pathname, scope]);

  return null;
}
