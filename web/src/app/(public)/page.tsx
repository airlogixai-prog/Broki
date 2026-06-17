import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function LandingPage() {
  return (
    <PublicPageShell>
      <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="max-w-4xl text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
          Automatización Inteligente con IA
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[#a8b2d1] sm:text-xl">
          Centraliza, automatiza y conecta tu empresa con soluciones de IA a medida.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/solicita-demo"
            className="rounded-full bg-[#41ead4] px-10 py-3 font-bold text-[#0d1b2a] transition hover:bg-[#31b59d]"
          >
            Solicita una Demo
          </Link>
          <Link
            href="/broki"
            className="rounded-full border border-[#41ead4] px-10 py-3 font-bold text-[#41ead4] transition hover:bg-[#41ead4]/10"
          >
            Acceder a BROKI
          </Link>
        </div>
      </section>

      <section className="bg-[#172a45] py-20">
        <div className="container mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 md:grid-cols-3">
          {[
            { title: "Centraliza", desc: "Toda tu información y operaciones en un solo entorno unificado." },
            { title: "Automatiza", desc: "Flujos inteligentes que ahorran tiempo y reducen errores humanos." },
            { title: "Conecta", desc: "Integra plataformas y herramientas en un ecosistema coherente." },
          ].map((card) => (
            <div key={card.title} className="rounded-lg bg-[#0d1b2a] p-8 text-center shadow-lg">
              <h3 className="text-xl font-bold text-[#ccd6f6]">{card.title}</h3>
              <p className="mt-2 text-[#a8b2d1]">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
