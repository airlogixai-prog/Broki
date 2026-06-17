import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-[#172a45] py-8 text-center text-sm text-[#a8b2d1]">
      <p>© {new Date().getFullYear()} AIRLOGIX AI. Todos los derechos reservados.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        <Link href="/aviso-legal" className="hover:text-[#41ead4]">Aviso Legal</Link>
        <Link href="/politica-privacidad" className="hover:text-[#41ead4]">Privacidad</Link>
        <Link href="/politica-cookies" className="hover:text-[#41ead4]">Cookies</Link>
        <Link href="/contacto" className="hover:text-[#41ead4]">Contacto</Link>
      </div>
    </footer>
  );
}
