import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa/PwaRegister";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PwaRegister scope="marketing" />
      {children}
    </>
  );
}
