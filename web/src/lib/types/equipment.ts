export type EquipmentType = "furgo" | "gse";

export type StatusCategory = "available" | "occupied" | "inoperative" | "unknown";

export interface Equipment {
  id: string;
  type: EquipmentType;
  family: string;
  model: string;
  plate: string;
  location: string;
  parking?: string;
  plane: string;
  worker: string;
  notes: string;
  status: string;
  seats?: number;
  fuel: number | null;
  pressures: number[];
  // N2 raw bottles
  botella_1?: number | null;
  botella_2?: number | null;
  botella_3?: number | null;
  botella_4?: number | null;
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
  reg: string;
  airline: string;
  model: string;
}

export interface WorkTask {
  db_id?: string | number;
  type: string;
  code: string;
  priority: string;
  desc: string;
  notes?: string;
  done: boolean;
}

export interface WorkGroup {
  id: string | number;
  matricula: string;
  modelo: string;
  aerolinea: string;
  salida: string;
  responsable: string;
  furgo: string;
  workers: string[];
  tasks: WorkTask[];
}

export interface NitrogenStock {
  ubicacion: string;
  llenas: number;
  vacias: number;
}

export type Theme =
  | "default"
  | "oceanic"
  | "forest"
  | "sunset"
  | "midnight"
  | "monochrome";
