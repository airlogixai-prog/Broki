import { LegalPageLayout } from "@/components/public/LegalPageLayout";
import { LegalHtml } from "@/components/public/LegalHtml";
import { pageMetadata } from "@/lib/public/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Política de Privacidad",
  description: "Política de privacidad y protección de datos de AIRLOGIX AI.",
  path: "/politica-privacidad",
});

export default function PrivacidadPage() {
  return (
    <LegalPageLayout title="Política de Privacidad">
      <LegalHtml file="politica-privacidad" />
    </LegalPageLayout>
  );
}
