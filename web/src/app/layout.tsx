import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BROKI Dashboard | GSE & Furgonetas",
  description: "Gestión de equipos GSE, furgonetas y operaciones aeroportuarias",
  manifest: "/manifest.json",
  icons: { icon: "/images/favicon.png", apple: "/assets/icon.jpg" },
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
