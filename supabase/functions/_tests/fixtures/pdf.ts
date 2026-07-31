// Minimal uncompressed PDF writer for integration smoke tests.
// Readable text layer — same bytes the Edge Function PDF parsers consume.

const escape = (line: string) =>
  line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Builds a single-page PDF whose text layer is `lines`, one line per row. */
export function makeTextPdf(lines: string[]): Uint8Array {
  const content =
    "BT\n/F1 10 Tf\n12 TL\n40 800 Td\n" +
    lines.map((l) => `(${escape(l)}) Tj T*`).join("\n") +
    "\nET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xref}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

export const plannerPdfLines = [
  "HOJA DE TRABAJO",
  "MATRICULA: EC-NFP",
  "MODELO: A330-300",
  "AEROLINEA: IBEROJET",
  "FECHA: 2026-03-16",
  "MEL-2201 NO GO Revision tren principal derecho",
  "DEF-0075 NORMAL Cambio filtro hidraulico",
];

export const rosterPdfLines = [
  "HORARIO SEMANAL W2F",
  "SEMANA 16/03/2026 - 22/03/2026",
  "NOMBRE CERT LUN MAR MIE JUE VIE SAB DOM",
  "MARIO LORENZO B1 07:00-19:00 07:00-19:00 L L 19:00-07:00 19:00-07:00 L",
  "ENRIQUE GARCIA B2 L L 07:00-19:00 07:00-19:00 L L 07:00-19:00",
  "ANA SOTO CAT A 19:00-07:00 L L 19:00-07:00 07:00-19:00 L L",
];

export const plannerPdf = () => makeTextPdf(plannerPdfLines);
export const rosterPdf = () => makeTextPdf(rosterPdfLines);
