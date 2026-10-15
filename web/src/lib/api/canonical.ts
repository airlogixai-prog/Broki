/**
 * Contratos tipados del canónico tal como los devuelven las Edge Functions
 * (`select("*")` / filas mapeadas). Sustituye `Record<string, unknown>` donde
 * hay contrato de negocio claro.
 */

export type AssetKind = "van" | "gse" | "inventory" | "tooling" | "nitro" | "card" | "tablet" | "aircraft" | "other";

/** broki_assets — inventory-list */
export interface AssetRow {
  id: string;
  external_id: string;
  source_system: string;
  source_table: string;
  asset_kind: AssetKind | string;
  identifier: string;
  descripcion: string | null;
  nombre_equipo: string | null;
  matricula: string | null;
  familia: string | null;
  plazas: string | null;
  estado: string | null;
  ubicacion_habitual: string | null;
  parking: string | null;
  avion_text: string | null;
  aircraft_id: string | null;
  current_worker_text: string | null;
  current_worker_id: string | null;
  worker_name_snapshot?: string | null;
  aircraft_registration_snapshot?: string | null;
  combustible: number | null;
  adblue: number | null;
  nitrogeno_1: number | null;
  nitrogeno_2: number | null;
  nitrogeno_3: number | null;
  nitrogeno_4: number | null;
  notas: string | null;
  /** Row version used for optimistic concurrency (equipment-update → 409 stale_update). */
  updated_at?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

/** broki_aircraft — aircraft-list */
export interface AircraftRow {
  id: string;
  matricula: string | null;
  modelo: string | null;
  aerolinea: string | null;
  msn: string | null;
  motor: string | null;
  estado: string | null;
  external_id?: string;
}

/** broki_personnel — personnel-list (campos operativos) */
export interface PersonnelRow {
  id: string;
  external_id: string | null;
  nombre: string | null;
  cod_empleado_aena: string | null;
  telefono: string | null;
  correo: string | null;
  auth_user_id?: string | null;
  certificador?: number | boolean | null;
  helper?: number | boolean | null;
  cat_a?: number | boolean | null;
  b1?: number | boolean | null;
  b2?: number | boolean | null;
  n_bac?: string | null;
  [key: string]: unknown;
}

/** broki_incidents — incidents */
export interface IncidentRow {
  id: string;
  incident_code: string | null;
  id_objeto: string | null;
  asset_id: string | null;
  descripcion: string | null;
  estado: number | null;
  status_text: string | null;
  trabajador_text: string | null;
  worker_id: string | null;
  aircraft_id: string | null;
  planner_task_id: string | null;
  fecha_apertura: string | null;
  fecha_cierre: string | null;
  fecha_modificacion: string | null;
  messages?: Array<{
    id?: string;
    user?: string;
    text?: string;
    time?: string;
    created_at?: string;
  }>;
}

export interface PlannerMemberRow {
  id?: string;
  position?: number;
  worker_text: string | null;
  person_id?: string | null;
}

/** broki_planner_groups (+ members embed) */
export interface PlannerGroupRow {
  id: string;
  external_id?: string | null;
  id_avion: string | null;
  aircraft_id: string | null;
  modelo: string | null;
  aerolinea: string | null;
  vehiculo: string | null;
  vehicle_asset_id: string | null;
  responsable: string | null;
  responsible_person_id: string | null;
  hora_llegada: string | null;
  hora_salida: string | null;
  fecha_modificacion: string | null;
  created_at?: string | null;
  members?: PlannerMemberRow[];
}

/** broki_planner_tasks */
export interface PlannerTaskRow {
  id: string;
  group_id: string | null;
  tipo_tarea: string | null;
  codigo: string | null;
  matricula_avion: string | null;
  aircraft_id: string | null;
  prioridad: string | null;
  descripcion: string | null;
  notas: string | null;
  estado: number | null;
  fecha: string | null;
}

/** broki_tooling_catalog */
export interface ToolingCatalogRow {
  id: string;
  bac_bact: string | null;
  codigo: string | null;
  descripcion: string | null;
  familia: string | null;
  estado: string | null;
  tipo: string | null;
  supplier: string | null;
  manufacturer: string | null;
  part_number: string | null;
  serial_number: string | null;
  ubicacion_habitual: string | null;
  raw_payload?: Record<string, unknown> | null;
}

/** broki_tooling_movements */
export interface ToolingMovementRow {
  id: string;
  tool_id: string | null;
  bac_bact: string | null;
  descripcion: string | null;
  tma_out: string | null;
  tma_out_person_id: string | null;
  /** Condition at checkout: "Completo" | "Defectuoso" (legacy good/defective). */
  complete_out?: string | null;
  date_out: string | null;
  tma_in: string | null;
  tma_in_person_id: string | null;
  /** Condition at return: "Completo" | "Defectuoso" (legacy correct/defective). */
  complete_in?: string | null;
  date_in: string | null;
  remarks: string | null;
  avion: string | null;
  aircraft_id: string | null;
}

export interface ToolingListResponse {
  catalog: ToolingCatalogRow[];
  movements: ToolingMovementRow[];
}

/** broki_nitro_stock */
export interface NitroStockRow {
  id: string;
  ubicacion: string;
  botellas_llenas: number | null;
  botellas_vacias: number | null;
}
