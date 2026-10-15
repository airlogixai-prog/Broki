import Link from "next/link";

const COLS = [
  {
    title: "AIRLOGIX AI",
    body: (
      <>
        <p className="text-sm text-[#a8b2d1] mb-4">
          Automatización inteligente para operaciones y negocio.
        </p>
        <a href="mailto:info@airlogix.ai" className="text-[#41ead4] hover:underline text-sm">
          info@airlogix.ai
        </a>
      </>
    ),
  },
  {
    title: "Soluciones",
    links: [
      { href: "/soluciones", label: "Soluciones" },
      { href: "/integraciones", label: "Integraciones" },
      { href: "/solicita-demo", label: "Solicita demo" },
      { href: "/broki", label: "BROKI" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/sobre-nosotros", label: "Sobre nosotros" },
      { href: "/contacto", label: "Contacto" },
      { href: "/pres", label: "Presentación" },
      { href: "/registrobroki", label: "Registro personal" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/aviso-legal", label: "Aviso legal" },
      { href: "/politica-privacidad", label: "Privacidad" },
      { href: "/politica-cookies", label: "Cookies" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-[#172a45] bg-[#0d1b2a]">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4 sm:px-6">
        {COLS.map((col) => (
          <div key={col.title}>
            <h3 className="font-bold text-white mb-3">{col.title}</h3>
            {"body" in col && col.body}
            {"links" in col &&
              col.links?.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block text-sm text-[#a8b2d1] hover:text-[#41ead4] py-1"
                >
                  {l.label}
                </Link>
              ))}
          </div>
        ))}
      </div>
      <p className="border-t border-[#172a45] py-6 text-center text-sm text-[#a8b2d1]">
        © {new Date().getFullYear()} AIRLOGIX AI. Todos los derechos reservados.
      </p>
    </footer>
  );
}
