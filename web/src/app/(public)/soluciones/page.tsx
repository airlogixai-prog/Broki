import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

const SOLUTIONS = [
  { title: "Automatización de Procesos", desc: "Flujos n8n que eliminan tareas repetitivas y conectan tus sistemas." },
  { title: "Dashboards Operativos", desc: "Paneles como BROKI para monitorizar flotas, inventario y personal en tiempo real." },
  { title: "Agentes de IA", desc: "Asistentes inteligentes integrados en WhatsApp, email y tus herramientas internas." },
  { title: "Integración de Datos", desc: "Conecta CRM, ERP, hojas de cálculo y APIs en un ecosistema unificado." },
];

export default function SolucionesPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold text-white mb-4">Soluciones</h1>
        <p className="text-[#a8b2d1] max-w-2xl mb-12">
          Airlogix diseña sistemas de automatización e IA a medida para empresas que necesitan
          centralizar operaciones y reducir fricción.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SOLUTIONS.map((s) => (
            <div key={s.title} className="rounded-xl bg-[#172a45] p-6 border border-[#2a3f5f]">
              <h3 className="text-xl font-bold text-[#41ead4] mb-2">{s.title}</h3>
              <p className="text-[#a8b2d1]">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/solicita-demo" className="rounded-full bg-[#41ead4] px-8 py-3 font-bold text-[#0d1b2a] hover:bg-[#31b59d]">
            Solicita una Demo
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
