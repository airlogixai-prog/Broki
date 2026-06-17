import type { NextConfig } from "next";
import path from "path";

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

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return dashboardRedirects;
  },
};

export default nextConfig;
