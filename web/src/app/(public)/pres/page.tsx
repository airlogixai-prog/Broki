import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { pageMetadata } from "@/lib/public/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Presentación",
  description: "Presentación comercial de AIRLOGIX AI y BROKI.",
  path: "/pres",
});

const SLIDES = [
  {
    title: "AIRLOGIX AI",
    body: "Automatización inteligente para operaciones y negocio. Conectamos datos, personas y procesos.",
  },
  {
    title: "BROKI",
    body: "Dashboard operativo en tiempo real: GSE, furgonetas, planificador, horarios, tooling y más.",
  },
  {
    title: "Integraciones",
    body: "APIs, bases de datos y flujos sin depender de hojas sueltas ni duplicar trabajo.",
  },
  {
    title: "Siguiente paso",
    body: "Agenda una demo personalizada con tu equipo.",
  },
];

export default function PresPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold text-white mb-4 text-center">
          Presentación AIRLOGIX AI
        </h1>
        <p className="text-[#a8b2d1] max-w-2xl mx-auto text-center mb-12">
          Resumen ejecutivo. La presentación interactiva legacy se sustituye por esta versión
          accesible y mantenible en Next.js.
        </p>
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {SLIDES.map((s, i) => (
            <article
              key={s.title}
              className="rounded-xl border border-[#2a3f5f] bg-[#172a45] p-6"
              aria-label={`Diapositiva ${i + 1}: ${s.title}`}
            >
              <span className="text-xs font-bold text-[#41ead4]">#{i + 1}</span>
              <h2 className="text-xl font-bold text-white mt-2">{s.title}</h2>
              <p className="mt-2 text-[#a8b2d1] text-sm">{s.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            href="/solicita-demo"
            className="rounded-full bg-[#41ead4] px-8 py-3 font-bold text-[#0d1b2a] hover:bg-[#31b59d]"
          >
            Solicitar Demo
          </Link>
          <Link
            href="/broki"
            className="rounded-full border border-[#41ead4] px-8 py-3 font-bold text-[#41ead4] hover:bg-[#41ead4]/10"
          >
            Ver BROKI
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
