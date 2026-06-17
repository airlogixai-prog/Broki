import { PublicPageShell } from "@/components/public/PublicPageShell";

const INTEGRATIONS = [
  { name: "WhatsApp Business", desc: "Agentes IA que consultan CRM, inventario e informes conversando por WhatsApp." },
  { name: "n8n", desc: "Orquestación de flujos, webhooks y automatizaciones sin código." },
  { name: "Google Workspace", desc: "Sheets, Drive y Gmail integrados en tus procesos." },
  { name: "Supabase", desc: "Auth, base de datos y edge functions para apps escalables." },
  { name: "ERP / CRM", desc: "Conexión con sistemas de gestión empresarial existentes." },
  { name: "APIs REST", desc: "Integración con cualquier servicio que exponga API." },
];

export default function IntegracionesPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold text-white mb-4">Integraciones</h1>
        <p className="text-[#a8b2d1] max-w-2xl mb-12">
          Conectamos tus herramientas actuales en un ecosistema coherente. Sin migraciones forzadas.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {INTEGRATIONS.map((i) => (
            <div key={i.name} className="rounded-xl bg-[#172a45] p-6 border border-[#2a3f5f]">
              <h3 className="text-lg font-bold text-white mb-2">{i.name}</h3>
              <p className="text-sm text-[#a8b2d1]">{i.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
