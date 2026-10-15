import { LegalPageLayout } from "@/components/public/LegalPageLayout";
import { LegalHtml } from "@/components/public/LegalHtml";
import { pageMetadata } from "@/lib/public/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Política de Cookies",
  description: "Información sobre el uso de cookies en airlogix.ai.",
  path: "/politica-cookies",
});

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Política de Cookies">
      <LegalHtml file="politica-cookies" />
    </LegalPageLayout>
  );
}
