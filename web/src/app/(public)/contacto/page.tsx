import { PublicPageShell } from "@/components/public/PublicPageShell";
import { ContactForm } from "@/components/public/ContactForm";
import { pageMetadata } from "@/lib/public/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: "Contacto",
  description:
    "Contacta con AIRLOGIX AI para información, presupuestos o dudas sobre automatización.",
  path: "/contacto",
});

export default function ContactoPage() {
  return (
    <PublicPageShell>
      <section className="bg-[#172a45] py-16 text-center">
        <h1 className="text-4xl font-bold text-white md:text-5xl">Hablemos</h1>
        <p className="mt-4 max-w-2xl mx-auto text-[#a8b2d1]">
          Estamos aquí para responder tus preguntas. Contáctanos para empezar a transformar tu negocio.
        </p>
      </section>
      <section className="container mx-auto px-4 py-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-white">Información de contacto</h2>
            <p className="mt-4 text-[#a8b2d1]">
              Escríbenos por correo o usa el formulario. Te responderemos lo antes posible.
            </p>
            <a
              href="mailto:info@airlogix.ai"
              className="mt-6 inline-block text-[#41ead4] font-semibold hover:underline"
            >
              info@airlogix.ai
            </a>
          </div>
          <ContactForm variant="contact" />
        </div>
      </section>
    </PublicPageShell>
  );
}
