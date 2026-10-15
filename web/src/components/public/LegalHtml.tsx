import { readFileSync } from "fs";
import { join } from "path";

const ALLOWED = new Set(["aviso-legal", "politica-privacidad", "politica-cookies"]);

interface Props {
  file: string;
}

export function LegalHtml({ file }: Props) {
  if (!ALLOWED.has(file)) {
    return <p className="text-red-400">Contenido no disponible.</p>;
  }
  const html = readFileSync(
    join(process.cwd(), "src/content/legal", `${file}.html`),
    "utf-8",
  );
  return (
    <div
      className="legal-prose prose-invert max-w-none text-[#ccd6f6] [&_a]:text-[#41ead4] [&_h2]:text-white [&_h3]:text-white"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
