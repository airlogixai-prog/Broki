import type { NextConfig } from "next";
import path from "path";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const dashboardRedirects = [
  "mapa",
  "furgonetas",
  "gse",
  "aviones",
  "incidencias",
  "analytics",
  "planner",
  "roster",
  "fleet",
  "stock",
  "tooling",
].map((segment) => ({
  source: `/${segment}`,
  destination: `/broki/${segment}`,
  permanent: false,
}));

const legacyHtmlRedirects = [
  "index",
  "contacto",
  "integraciones",
  "soluciones",
  "sobre-nosotros",
  "solicita-demo",
  "aviso-legal",
  "politica-privacidad",
  "politica-cookies",
  "gracias",
  "pres",
  "registrobroki",
  "broki",
  "broki2",
].flatMap((page) => {
  const dest =
    page === "index"
      ? "/"
      : page === "broki" || page === "broki2"
        ? "/broki"
        : `/${page}`;
  return [
    { source: `/${page}.html`, destination: dest, permanent: true },
    ...(page === "index" ? [] : [{ source: `/${page}.htm`, destination: dest, permanent: true }]),
  ];
});

const nextConfig: NextConfig = {
  // Next 16 blocks dev assets/HMR for origins other than localhost; the E2E
  // scripts hit 127.0.0.1, which otherwise leaves the client un-hydrated.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return [...dashboardRedirects, ...legacyHtmlRedirects];
  },
};

export default withBundleAnalyzer(nextConfig);
