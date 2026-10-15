export const SITE = {
  name: "AIRLOGIX AI",
  title: "AIRLOGIX AI | Automatización Inteligente",
  description:
    "Centraliza, automatiza y conecta tu empresa con soluciones de IA a medida. BROKI para operaciones aeroportuarias.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://airlogix.ai",
  themeColor: "#0d1b2a",
  accentColor: "#41ead4",
  locale: "es_ES",
} as const;

export function pageMetadata(opts: {
  title: string;
  description: string;
  path?: string;
}) {
  const url = opts.path ? `${SITE.url}${opts.path}` : SITE.url;
  return {
    title: opts.title,
    description: opts.description,
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      type: "website" as const,
      images: [{ url: `${SITE.url}/images/logo_3.png`, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: opts.title,
      description: opts.description,
      images: [`${SITE.url}/images/logo_3.png`],
    },
    alternates: { canonical: url },
  };
}
