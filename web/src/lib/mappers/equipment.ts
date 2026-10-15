import type { AircraftRow, AssetRow, PersonnelRow } from "@/lib/api/canonical";
import type { Equipment, Personnel, Aircraft, StatusCategory } from "@/lib/types/equipment";

const uc = (s: unknown): string => String(s ?? "").trim();
export function toNumber(n: unknown, fallback = 0): number {
  if (n == null || n === "") return fallback;
  if (typeof n === "number") return n;
  const v = parseFloat(String(n).replace("%", "").replace(",", ".").trim());
  return isNaN(v) ? fallback : v;
}

/** Legacy aliases still accepted on AssetRow-shaped payloads. */
type AssetLike = Omit<
  Partial<AssetRow>,
  | "nitrogeno_1"
  | "nitrogeno_2"
  | "nitrogeno_3"
  | "nitrogeno_4"
  | "combustible"
  | "adblue"
  | "plazas"
> & {
  identificador?: string;
  vehiculo?: string;
  trabajadores?: string;
  trabajador?: string;
  avion?: string;
  brk?: string;
  brk_id?: string;
  BRK?: string;
  "BRK-ID"?: string;
  ubicacion?: string;
  fuel?: number | string | null;
  persona?: string;
  nitrogeno_1?: number | string | null;
  nitrogeno_2?: number | string | null;
  nitrogeno_3?: number | string | null;
  nitrogeno_4?: number | string | null;
  combustible?: number | string | null;
  adblue?: number | string | null;
  plazas?: number | string | null;
};

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

// Mirrors getStatusCategory() from broki.html, with the keyword order fixed.
// These are substring matches, so the order decides the result: "INOPERATIVO"
// contains "OPERATIVO" and "EN USO" contains "US". Legacy checked available
// first and therefore painted inoperative equipment green. Checking occupied,
// then inoperative, then available is the only order where every keyword lands
// in its own bucket.
export function getStatusCategory(status: string): StatusCategory {
  if (!status) return "unknown";
  const s = status.toUpperCase().trim();
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
  if (["DISPONIBLE", "OPERATIVO", "LIBRE"].some((k) => s.includes(k)))
    return "available";
  return "unknown";
}

export function getStatusClass(status: string): string {
  const cat = getStatusCategory(status);
  if (cat === "available") return "bg-success-muted text-success-strong border-success/30";
  if (cat === "occupied") return "bg-warning-muted text-warning-strong border-warning/30";
  if (cat === "inoperative") return "bg-danger-muted text-danger-strong border-danger/30";
  return "bg-neutral-muted text-fg-muted border-border";
}

// Mirrors normalizeFurgo() from broki.html ~L2026
export function normalizeFurgo(f: AssetLike): Equipment {
  const base: Equipment = {
    id: uc(f.identifier ?? f.identificador ?? f.id),
    dbId: f.id ? String(f.id) : undefined,
    type: "furgo",
    family: "",
    model: uc(f.descripcion ?? f.nombre_equipo ?? f.vehiculo),
    seats: toNumber(f.plazas, 0),
    plate: uc(f.matricula),
    location: uc(f.parking) || "BASE",
    usualLocation: uc(f.ubicacion_habitual) || "BASE",
    parking: uc(f.parking) || "BASE",
    plane: uc(f.avion_text ?? f.avion ?? f.aircraft_registration_snapshot),
    // No reading stays null (the UI shows "Sin lectura"); the legacy 100 % default hid empty tanks.
    fuel: f.combustible != null && f.combustible !== "" ? toNumber(f.combustible, 0) : null,
    adblue: f.adblue != null && f.adblue !== "" ? toNumber(f.adblue, 0) : null,
    worker: uc(
      f.current_worker_text ?? f.worker_name_snapshot ?? f.trabajadores ?? f.trabajador,
    ),
    workerId: f.current_worker_id ?? null,
    notes: uc(f.notas),
    status: uc(f.estado) || "Disponible",
    pressures: [],
    updatedAt: f.updated_at ?? null,
  };
  base.family = getFamily(base);
  return base;
}

// Mirrors normalizeGSE() from broki.html ~L2042
export function normalizeGSE(g: AssetLike): Equipment {
  const base: Equipment = {
    id: uc(
      g.identifier ?? g.brk ?? g.brk_id ?? g.BRK ?? g["BRK-ID"] ?? g.identificador ?? g.id,
    ),
    dbId: g.id ? String(g.id) : undefined,
    type: "gse",
    family: "",
    model: uc(g.descripcion ?? g.nombre_equipo),
    plate: uc(g.matricula),
    seats: g.plazas != null && g.plazas !== "" ? toNumber(g.plazas, 0) : undefined,
    adblue: g.adblue != null && g.adblue !== "" ? toNumber(g.adblue, 0) : null,
    location: uc(g.ubicacion_habitual ?? g.ubicacion),
    usualLocation: uc(g.ubicacion_habitual ?? g.ubicacion),
    parking: uc(g.parking),
    plane: uc(g.avion_text ?? g.avion ?? g.aircraft_registration_snapshot),
    fuel:
      g.combustible != null
        ? toNumber(g.combustible, 0)
        : g.fuel != null && g.fuel !== ""
          ? toNumber(g.fuel, 0)
          : null,
    worker: uc(
      g.current_worker_text ??
        g.worker_name_snapshot ??
        g.trabajadores ??
        g.trabajador ??
        g.persona,
    ),
    workerId: g.current_worker_id ?? null,
    notes: uc(g.notas),
    status: uc(g.estado) || "Disponible",
    botella_1: g.nitrogeno_1 != null && g.nitrogeno_1 !== "" ? toNumber(g.nitrogeno_1, 0) : null,
    botella_2: g.nitrogeno_2 != null && g.nitrogeno_2 !== "" ? toNumber(g.nitrogeno_2, 0) : null,
    botella_3: g.nitrogeno_3 != null && g.nitrogeno_3 !== "" ? toNumber(g.nitrogeno_3, 0) : null,
    botella_4: g.nitrogeno_4 != null && g.nitrogeno_4 !== "" ? toNumber(g.nitrogeno_4, 0) : null,
    pressures: [],
    updatedAt: g.updated_at ?? null,
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
export function normalizePersonnel(
  p: Partial<PersonnelRow> & { name?: string; worker?: string; rol?: string },
): Personnel {
  const rawName = uc(p.nombre || p.name || p.worker || p.id);
  const name = rawName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const quals: string[] = [];

  if (p.certificador) quals.push("Certificador");
  if (p.helper) quals.push("Helper");
  if (p.cat_a) quals.push("CAT-A");
  if (p.b1) quals.push("B1");
  if (p.b2) quals.push("B2");
  if (p.n_bac) quals.push(String(p.n_bac));

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
    id: uc(p.cod_empleado_aena ?? p.external_id ?? p.id ?? name),
    name,
    qualifications: [...new Set(quals)],
    role: p.rol || (p.certificador ? "Certificador" : "Operario"),
  };
}

export function normalizeAircraft(a: AircraftRow | (Partial<AircraftRow> & Record<string, unknown>)): Aircraft {
  const row = a as AircraftRow & { registration?: string; reg?: string; airline?: string; model?: string };
  return {
    id: String(row.id ?? ""),
    reg: uc(row.matricula || row.registration || row.reg),
    airline: uc(row.aerolinea || row.airline),
    model: uc(row.modelo || row.model),
    msn: row.msn ? String(row.msn) : undefined,
    motor: row.motor ? String(row.motor) : undefined,
    status: row.estado ? String(row.estado) : undefined,
  };
}

export function splitInventory(rows: AssetLike[]): {
  furgonetas: Equipment[];
  gse: Equipment[];
} {
  const furgonetas: Equipment[] = [];
  const gse: Equipment[] = [];

  rows.forEach((row) => {
    const kind = uc(row.asset_kind).toLowerCase();
    const famUpper = uc(row.familia || "").toUpperCase();
    const isFurgo =
      kind === "van" ||
      famUpper.includes("FURGONETA") ||
      famUpper.includes("VEHICULO");

    if (isFurgo) {
      furgonetas.push(normalizeFurgo(row));
    } else {
      gse.push(normalizeGSE(row));
    }
  });

  return { furgonetas, gse };
}
