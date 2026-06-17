import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function SobreNosotrosPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold text-white mb-6">Sobre Nosotros</h1>
        <div className="space-y-4 text-[#a8b2d1] leading-relaxed">
          <p>
            AIRLOGIX AI es una compañía de automatización y sistemas inteligentes. Conectamos
            procesos, datos y herramientas mediante IA para reducir tiempos y maximizar eficiencia.
          </p>
          <p>
            Nuestro producto estrella, BROKI, es un dashboard operativo para gestión de flotas GSE,
            furgonetas, incidencias y planificación en entornos aeroportuarios.
          </p>
          <p>
            Trabajamos con n8n, Supabase y agentes de IA para construir soluciones escalables
            sin reinventar la rueda.
          </p>
        </div>
      </section>
    </PublicPageShell>
  );
}
