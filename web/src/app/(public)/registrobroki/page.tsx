import Link from "next/link";
import { PublicPageShell } from "@/components/public/PublicPageShell";

export default function RegistroBrokiPage() {
  return (
    <PublicPageShell>
      <section className="container mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-white mb-4">Registro BROKI</h1>
        <p className="text-[#a8b2d1] mb-8">
          El acceso al dashboard BROKI está restringido. Si necesitas una cuenta de operaciones,
          contacta con un administrador de AIRLOGIX AI.
        </p>
        <div className="rounded-xl bg-[#172a45] p-6 border border-[#2a3f5f] space-y-4">
          <p className="text-sm text-[#ccd6f6]">
            Usuarios existentes pueden iniciar sesión directamente.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-full bg-[#41ead4] px-8 py-3 font-bold text-[#0d1b2a] hover:bg-[#31b59d]"
          >
            Iniciar sesión
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
