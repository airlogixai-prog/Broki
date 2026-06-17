import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function GraciasPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">¡Gracias!</h1>
        <p className="text-[#a8b2d1] max-w-md mx-auto mb-8">
          Hemos recibido tu solicitud. Nos pondremos en contacto contigo lo antes posible.
        </p>
        <Link href="/" className="rounded-full bg-[#41ead4] px-8 py-3 font-bold text-[#0d1b2a] hover:bg-[#31b59d]">
          Volver al inicio
        </Link>
      </section>
    </PublicPageShell>
  );
}
