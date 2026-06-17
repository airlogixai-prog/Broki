import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function PresPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto max-w-3xl px-4 py-16 sm:px-6 text-center">
        <h1 className="text-4xl font-bold text-white mb-6">Presentación AIRLOGIX AI</h1>
        <p className="text-[#a8b2d1] mb-8 leading-relaxed">
          Descubre cómo automatizamos operaciones aeroportuarias, inventario y planificación
          con BROKI y flujos n8n. Soluciones reales desplegadas en producción.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/solicita-demo" className="rounded-full bg-[#41ead4] px-8 py-3 font-bold text-[#0d1b2a] hover:bg-[#31b59d]">
            Solicitar Demo
          </Link>
          <Link href="/broki" className="rounded-full border border-[#41ead4] px-8 py-3 font-bold text-[#41ead4] hover:bg-[#41ead4]/10">
            Ver BROKI
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
