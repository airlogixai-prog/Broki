import { LegalPageLayout } from "@/components/public/LegalPageLayout";
import { LegalHtml } from "@/components/public/LegalHtml";
import { pageMetadata } from "@/lib/public/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Aviso Legal",
  description: "Aviso legal de AIRLOGIX AI.",
  path: "/aviso-legal",
});

export default function AvisoLegalPage() {
  return (
    <LegalPageLayout title="Aviso Legal">
      <LegalHtml file="aviso-legal" />
    </LegalPageLayout>
  );
}
