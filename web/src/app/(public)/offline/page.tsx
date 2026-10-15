import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function OfflinePage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-bold text-white">Sin conexión</h1>
        <p className="mt-4 text-[#a8b2d1]">
          No hay red disponible. Revisa tu conexión e inténtalo de nuevo.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-[#41ead4] px-8 py-3 font-bold text-[#0d1b2a]"
        >
          Volver al inicio
        </Link>
      </section>
    </PublicPageShell>
  );
}
