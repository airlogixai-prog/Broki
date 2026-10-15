import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BROKI Dashboard",
  description: "Gestión de equipos GSE, furgonetas y operaciones aeroportuarias",
  manifest: "/manifest.json",
};

export default function BrokiRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
