import type { Equipment, Personnel, Aircraft, StatusCategory } from "@/lib/types/equipment";

const uc = (s: unknown): string => String(s ?? "").trim();
export function toNumber(n: unknown, fallback = 0): number {
  if (n == null || n === "") return fallback;
  if (typeof n === "number") return n;
  const v = parseFloat(String(n).replace("%", "").replace(",", ".").trim());
  return isNaN(v) ? fallback : v;
}

// Mirrors getFamily() from broki.html ~L1620
export function getFamily(item: Pick<Equipment, "model" | "id" | "type">): string {
  const text = (item.model + " " + item.id).toUpperCase();
  const id = item.id.toUpperCase();

  if (text.includes("NITROGENO") || text.includes("NITRÓGENO")) return "Nitrógeno";
  if (text.includes("OXIGENO") || text.includes("OXÍGENO")) return "Oxígeno";
  if (text.includes("ESCALERA")) return "Escaleras";
  if (text.includes("PLATAFORMA")) return "Plataformas";
  if (
    text.includes("GATO") ||
    text.includes("HYDRAMITE") ||
    text.includes("TANGYE")
  )
    return "Gatos Hidráulicos";
  if (
    text.includes("GPU") ||
    text.includes("GENERADOR") ||
    text.includes("GRUPO") ||
    text.includes("POWER UNIT")
  )
    return "GPUs y Generadores";
  if (text.includes("COMPRESOR")) return "Compresores";
  if (text.includes("DOLLY")) return "Dollys";
  if (text.includes("CALZO")) return "Calzos";
  if (text.includes("CONO")) return "Conos";
  if (text.includes("MANTIENE") || text.includes("TALLER")) return "Mantenimiento";
  if (text.includes("FURGO") || item.type === "furgo") return "Vehículos";
  if (text.includes("CARRO")) return "Carros";
  if (text.includes("TABLET")) return "Tablets";
  if (text.includes("TARJETA") || text.includes("COMBUSTIBLE")) return "Tarjetas";
  if (text.includes("TRAILER") || text.includes("REMOLQUE")) return "Remolques";
  if (
    text.includes("GRUA") ||
    text.includes("CRANE") ||
    text.includes("CAZO")
  )
    return "Grúas";
  if (text.includes("PALLET") || text.includes("TRANSPALETA")) return "Transpaletas";
  if (text.includes("LAVADO")) return "Limpieza";
  if (id.startsWith("E-")) return "Escaleras";
  if (id.startsWith("P-")) return "Plataformas";
  if (id.startsWith("G-")) return "Vehículos";

  return "Otros Equipos";
}

// Mirrors getStatusCategory() from broki.html
export function getStatusCategory(status: string): StatusCategory {
  if (!status) return "unknown";
  const s = status.toUpperCase().trim();
  if (["DISPONIBLE", "OPERATIVO", "LIBRE"].some((k) => s.includes(k)))
    return "available";
  if (["EN USO", "OCUPADO", "RESERVADO", "TRANSITO"].some((k) => s.includes(k)))
    return "occupied";
  if (
    [
      "INOPERATIVO",
      "MANTENIMIENTO",
      "INCIDENCIA",
      "US",
      "U.S.",
      "AVERIADO",
    ].some((k) => s.includes(k))
  )
    return "inoperative";
  return "unknown";
}

export function getStatusClass(status: string): string {
  const cat = getStatusCategory(status);
  if (cat === "available") return "bg-emerald-500 text-white border-emerald-600";
  if (cat === "occupied") return "bg-amber-400 text-amber-900 border-amber-500";
  if (cat === "inoperative") return "bg-red-600 text-white border-red-700";
  return "bg-slate-400 text-white border-slate-500";
}

// Mirrors normalizeFurgo() from broki.html ~L2026
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeFurgo(f: any): Equipment {
  const base: Equipment = {
    id: uc(f.identificador || f.id),
    type: "furgo",
    family: "",
    model: uc(f.vehiculo || f.descripcion),
    seats: toNumber(f.plazas, 0),
    plate: uc(f.matricula),
    location: uc(f.parking) || "BASE",
    plane: uc(f.avion),
    fuel: toNumber(f.combustible, 100),
    worker: uc(f.trabajadores || f.trabajador),
    notes: uc(f.notas),
    status: uc(f.estado) || "Disponible",
    pressures: [],
  };
  base.family = getFamily(base);
  return base;
}

// Mirrors normalizeGSE() from broki.html ~L2042
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeGSE(g: any): Equipment {
  const base: Equipment = {
    id: uc(g.brk || g.brk_id || g.BRK || g["BRK-ID"] || g.identificador || g.id),
    type: "gse",
    family: "",
    model: uc(g.descripcion),
    plate: "",
    location: uc(g.ubicacion_habitual || g.ubicacion),
    parking: uc(g.parking),
    plane: uc(g.avion),
    fuel: null,
    worker: uc(g.trabajadores || g.trabajador || g.persona),
    notes: uc(g.notas),
    status: uc(g.estado) || "Disponible",
    botella_1: g.nitrogeno_1 ?? null,
    botella_2: g.nitrogeno_2 ?? null,
    botella_3: g.nitrogeno_3 ?? null,
    botella_4: g.nitrogeno_4 ?? null,
    pressures: [],
  };
  base.family = getFamily(base);
  if (base.family === "Nitrógeno") {
    base.pressures = [
      toNumber(g.nitrogeno_1, 0),
      toNumber(g.nitrogeno_2, 0),
      toNumber(g.nitrogeno_3, 0),
      toNumber(g.nitrogeno_4, 0),
    ];
  }
  return base;
}

// Mirrors normalizePersonal() from broki.html ~L2080
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePersonnel(p: any): Personnel {
  const rawName = uc(p.nombre || p.name || p.worker || p.id);
  const name = rawName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const quals: string[] = [];

  if (p.certificador) quals.push("Certificador");
  if (p.helper) quals.push("Helper");
  if (p.cat_a) quals.push("CAT-A");
  if (p.b1) quals.push("B1");
  if (p.b2) quals.push("B2");
  if (p.n_bac) quals.push(p.n_bac);

  const fmt = (k: string) =>
    k
      .toUpperCase()
      .replace(/_/g, " ")
      .replace(/AIRBUS/g, "")
      .replace(/BOEING/g, "B")
      .replace(/FAMILY/g, "")
      .trim();

  Object.keys(p).forEach((k) => {
    if (p[k] === 1) {
      if (k.startsWith("b1_") && k !== "b1") quals.push(`B1 ${fmt(k.substring(3))}`);
      else if (k.startsWith("b2_") && k !== "b2") quals.push(`B2 ${fmt(k.substring(3))}`);
      else if (k.startsWith("a_") && k !== "cat_a" && !k.startsWith("a_otros"))
        quals.push(`A ${fmt(k.substring(2))}`);
    }
  });

  return {
    id: uc(p.id || name),
    name,
    qualifications: [...new Set(quals)],
    role: p.rol || (p.certificador ? "Certificador" : "Operario"),
  };
}

// Mirrors aircraft normalize from fetchData broki.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeAircraft(a: any): Aircraft {
  return {
    reg: uc(a.matricula || a.registration || a.reg),
    airline: uc(a.aerolinea || a.airline),
    model: uc(a.modelo || a.model),
  };
}

// Split unified inventory response into furgos + gse
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function splitInventory(rows: any[]): {
  furgonetas: Equipment[];
  gse: Equipment[];
} {
  const furgonetas: Equipment[] = [];
  const gse: Equipment[] = [];

  rows.forEach((row) => {
    const famUpper = uc(row.familia || row.type || "").toUpperCase();
    const isFurgo =
      famUpper.includes("FURGONETA") || famUpper.includes("VEHICULO");

    if (isFurgo) {
      furgonetas.push(normalizeFurgo(row));
    } else {
      gse.push(normalizeGSE(row));
    }
  });

  return { furgonetas, gse };
}
