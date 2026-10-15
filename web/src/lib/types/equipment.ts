export type EquipmentType = "furgo" | "gse";

export type StatusCategory = "available" | "occupied" | "inoperative" | "unknown";

export interface Equipment {
  /** Identificador operativo (BRK / G*-* / plate code). */
  id: string;
  /** UUID canónico broki_assets.id cuando la EF lo envía. */
  dbId?: string;
  type: EquipmentType;
  family: string;
  /** descripcion | vehiculo (enrichment). */
  model: string;
  plate: string;
  /** Ubicación habitual (broki_assets.ubicacion_habitual). */
  location: string;
  usualLocation: string;
  parking: string;
  plane: string;
  /** Snapshot / current_worker_text (UI). */
  worker: string;
  /** UUID broki_personnel cuando resuelto. */
  workerId?: string | null;
  notes: string;
  status: string;
  seats?: number;
  fuel: number | null;
  adblue?: number | null;
  pressures: number[];
  // N2 raw bottles
  botella_1?: number | null;
  botella_2?: number | null;
  botella_3?: number | null;
  botella_4?: number | null;
  /** broki_assets.updated_at as received; sent back on edit to detect concurrent writes. */
  updatedAt?: string | null;
}

export interface IncidentMessage {
  user: string;
  text: string;
  time: string;
}

export interface Incident {
  id: string;
  openedAt: string;
  closedAt?: string;
  messages: IncidentMessage[];
}

export interface IncidentState {
  current: Incident | null;
  history: Incident[];
}

export interface Personnel {
  id: string;
  name: string;
  qualifications: string[];
  role: string;
}

export interface Aircraft {
  id: string;
  reg: string;
  airline: string;
  model: string;
  msn?: string;
  motor?: string;
  status?: string;
}

export interface WorkTask {
  db_id: string;
  type: string;
  code: string;
  priority: string;
  desc: string;
  notes?: string;
  done: boolean;
}

export interface WorkGroup {
  id: string;
  matricula: string;
  modelo: string;
  aerolinea: string;
  salida: string;
  /** Arrival time, "BASE" or "PRE" (legacy ETA / EN BASE badge). */
  llegada: string;
  responsable: string;
  furgo: string;
  workers: string[];
  tasks: WorkTask[];
}
