import { PublicPageShell } from "@/components/public/PublicPageShell";
import { ContactForm } from "@/components/public/ContactForm";

export default function ContactoPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto px-4 py-16 sm:px-6">
        <ContactForm title="Contacto" />
      </section>
    </PublicPageShell>
  );
}
