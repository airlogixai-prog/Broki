export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      broki_aircraft: {
        Row: {
          aerolinea: string | null
          created_at: string
          estado: string | null
          external_id: string
          id: string
          legacy_id: number | null
          matricula: string | null
          modelo: string | null
          raw_payload: Json
          source_system: string
          source_table: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          aerolinea?: string | null
          created_at?: string
          estado?: string | null
          external_id: string
          id?: string
          legacy_id?: number | null
          matricula?: string | null
          modelo?: string | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          aerolinea?: string | null
          created_at?: string
          estado?: string | null
          external_id?: string
          id?: string
          legacy_id?: number | null
          matricula?: string | null
          modelo?: string | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      broki_asset_aliases: {
        Row: {
          alias: string
          alias_type: string | null
          asset_id: string
          created_at: string
          id: string
        }
        Insert: {
          alias: string
          alias_type?: string | null
          asset_id: string
          created_at?: string
          id?: string
        }
        Update: {
          alias?: string
          alias_type?: string | null
          asset_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broki_asset_aliases_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "broki_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_assets: {
        Row: {
          adblue: number | null
          aircraft_id: string | null
          asset_kind: string
          avion_text: string | null
          combustible: number | null
          created_at: string
          current_worker_id: string | null
          current_worker_text: string | null
          descripcion: string | null
          estado: string | null
          external_id: string
          familia: string | null
          id: string
          identifier: string
          legacy_id: number | null
          matricula: string | null
          nitrogeno_1: number | null
          nitrogeno_2: number | null
          nitrogeno_3: number | null
          nitrogeno_4: number | null
          nombre_equipo: string | null
          notas: string | null
          parking: string | null
          plazas: string | null
          raw_payload: Json
          source_system: string
          source_table: string
          synced_at: string | null
          ubicacion_habitual: string | null
          updated_at: string
        }
        Insert: {
          adblue?: number | null
          aircraft_id?: string | null
          asset_kind?: string
          avion_text?: string | null
          combustible?: number | null
          created_at?: string
          current_worker_id?: string | null
          current_worker_text?: string | null
          descripcion?: string | null
          estado?: string | null
          external_id: string
          familia?: string | null
          id?: string
          identifier: string
          legacy_id?: number | null
          matricula?: string | null
          nitrogeno_1?: number | null
          nitrogeno_2?: number | null
          nitrogeno_3?: number | null
          nitrogeno_4?: number | null
          nombre_equipo?: string | null
          notas?: string | null
          parking?: string | null
          plazas?: string | null
          raw_payload?: Json
          source_system?: string
          source_table: string
          synced_at?: string | null
          ubicacion_habitual?: string | null
          updated_at?: string
        }
        Update: {
          adblue?: number | null
          aircraft_id?: string | null
          asset_kind?: string
          avion_text?: string | null
          combustible?: number | null
          created_at?: string
          current_worker_id?: string | null
          current_worker_text?: string | null
          descripcion?: string | null
          estado?: string | null
          external_id?: string
          familia?: string | null
          id?: string
          identifier?: string
          legacy_id?: number | null
          matricula?: string | null
          nitrogeno_1?: number | null
          nitrogeno_2?: number | null
          nitrogeno_3?: number | null
          nitrogeno_4?: number | null
          nombre_equipo?: string | null
          notas?: string | null
          parking?: string | null
          plazas?: string | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          ubicacion_habitual?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broki_assets_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "broki_aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_assets_current_worker_id_fkey"
            columns: ["current_worker_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_audit_events: {
        Row: {
          actor_personnel_id: string | null
          actor_user_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          event_type: string
          id: string
          ip: unknown
          metadata: Json
          source_system: string | null
          source_webhook: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          actor_personnel_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          event_type: string
          id?: string
          ip?: unknown
          metadata?: Json
          source_system?: string | null
          source_webhook?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          actor_personnel_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          event_type?: string
          id?: string
          ip?: unknown
          metadata?: Json
          source_system?: string | null
          source_webhook?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broki_audit_events_actor_personnel_id_fkey"
            columns: ["actor_personnel_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_chat_histories: {
        Row: {
          content: string | null
          created_at: string
          external_id: string
          id: string
          legacy_id: number | null
          message: Json | null
          person_id: string | null
          raw_payload: Json
          role: string | null
          session_id: string
          source_system: string
          source_table: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          external_id: string
          id?: string
          legacy_id?: number | null
          message?: Json | null
          person_id?: string | null
          raw_payload?: Json
          role?: string | null
          session_id: string
          source_system?: string
          source_table?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          external_id?: string
          id?: string
          legacy_id?: number | null
          message?: Json | null
          person_id?: string | null
          raw_payload?: Json
          role?: string | null
          session_id?: string
          source_system?: string
          source_table?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broki_chat_histories_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_communications: {
        Row: {
          created_at: string
          external_id: string
          fecha_mensaje_in: string | null
          fecha_mensaje_out: string | null
          id: string
          id_chat: string
          legacy_id: number | null
          mensaje_in: string | null
          mensaje_out: string | null
          person_id: string | null
          raw_payload: Json
          respondido: boolean | null
          source_system: string
          source_table: string
          synced_at: string | null
          telefono: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id: string
          fecha_mensaje_in?: string | null
          fecha_mensaje_out?: string | null
          id?: string
          id_chat: string
          legacy_id?: number | null
          mensaje_in?: string | null
          mensaje_out?: string | null
          person_id?: string | null
          raw_payload?: Json
          respondido?: boolean | null
          source_system?: string
          source_table?: string
          synced_at?: string | null
          telefono: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string
          fecha_mensaje_in?: string | null
          fecha_mensaje_out?: string | null
          id?: string
          id_chat?: string
          legacy_id?: number | null
          mensaje_in?: string | null
          mensaje_out?: string | null
          person_id?: string | null
          raw_payload?: Json
          respondido?: boolean | null
          source_system?: string
          source_table?: string
          synced_at?: string | null
          telefono?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broki_communications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_incidents: {
        Row: {
          asset_id: string | null
          created_at: string
          descripcion: string | null
          estado: number | null
          external_id: string
          fecha_apertura: string | null
          fecha_cierre: string | null
          fecha_modificacion: string | null
          id: string
          id_objeto: string | null
          incident_code: string | null
          legacy_id: number | null
          raw_payload: Json
          source_system: string
          source_table: string
          status_text: string | null
          synced_at: string | null
          trabajador_text: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: number | null
          external_id: string
          fecha_apertura?: string | null
          fecha_cierre?: string | null
          fecha_modificacion?: string | null
          id?: string
          id_objeto?: string | null
          incident_code?: string | null
          legacy_id?: number | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          status_text?: string | null
          synced_at?: string | null
          trabajador_text?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: number | null
          external_id?: string
          fecha_apertura?: string | null
          fecha_cierre?: string | null
          fecha_modificacion?: string | null
          id?: string
          id_objeto?: string | null
          incident_code?: string | null
          legacy_id?: number | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          status_text?: string | null
          synced_at?: string | null
          trabajador_text?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broki_incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "broki_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_incidents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_legacy_import_errors: {
        Row: {
          created_at: string
          error_message: string
          external_id: string | null
          id: string
          row_data: Json | null
          snapshot_id: string | null
          source_system: string
          source_table: string
        }
        Insert: {
          created_at?: string
          error_message: string
          external_id?: string | null
          id?: string
          row_data?: Json | null
          snapshot_id?: string | null
          source_system: string
          source_table: string
        }
        Update: {
          created_at?: string
          error_message?: string
          external_id?: string | null
          id?: string
          row_data?: Json | null
          snapshot_id?: string | null
          source_system?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "broki_legacy_import_errors_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "broki_legacy_table_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_legacy_rows: {
        Row: {
          created_at: string
          external_id: string
          id: string
          row_data: Json
          row_hash: string | null
          source_schema: string | null
          source_system: string
          source_table: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          row_data: Json
          row_hash?: string | null
          source_schema?: string | null
          source_system: string
          source_table: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          row_data?: Json
          row_hash?: string | null
          source_schema?: string | null
          source_system?: string
          source_table?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      broki_legacy_table_snapshots: {
        Row: {
          failed_rows: number
          finished_at: string | null
          id: string
          imported_rows: number
          metadata: Json
          source_schema: string | null
          source_system: string
          source_table: string
          started_at: string
          status: string
          total_rows: number | null
        }
        Insert: {
          failed_rows?: number
          finished_at?: string | null
          id?: string
          imported_rows?: number
          metadata?: Json
          source_schema?: string | null
          source_system: string
          source_table: string
          started_at?: string
          status?: string
          total_rows?: number | null
        }
        Update: {
          failed_rows?: number
          finished_at?: string | null
          id?: string
          imported_rows?: number
          metadata?: Json
          source_schema?: string | null
          source_system?: string
          source_table?: string
          started_at?: string
          status?: string
          total_rows?: number | null
        }
        Relationships: []
      }
      broki_nitro_stock: {
        Row: {
          botellas_llenas: number | null
          botellas_vacias: number | null
          created_at: string
          external_id: string
          id: string
          raw_payload: Json
          source_system: string
          source_table: string
          synced_at: string | null
          ubicacion: string
          updated_at: string
        }
        Insert: {
          botellas_llenas?: number | null
          botellas_vacias?: number | null
          created_at?: string
          external_id: string
          id?: string
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          ubicacion: string
          updated_at?: string
        }
        Update: {
          botellas_llenas?: number | null
          botellas_vacias?: number | null
          created_at?: string
          external_id?: string
          id?: string
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          ubicacion?: string
          updated_at?: string
        }
        Relationships: []
      }
      broki_personnel: {
        Row: {
          a_a320_family: number | null
          a_airbus_a330: number | null
          a_airbus_a350: number | null
          a_atr_42_72: number | null
          a_boeing_737: number | null
          a_boeing_777: number | null
          a_boeing_787: number | null
          a_bombardier_crj: number | null
          a_embraer_e_jet: number | null
          a_otros: number | null
          b1: boolean | null
          b1_a320_family: number | null
          b1_airbus_a330: number | null
          b1_airbus_a350: number | null
          b1_atr_42_72: number | null
          b1_boeing_737: number | null
          b1_boeing_777: number | null
          b1_boeing_787: number | null
          b1_bombardier_crj: number | null
          b1_embraer_e_jet: number | null
          b1_otros: number | null
          b2: boolean | null
          b2_a320_family: number | null
          b2_airbus_a330: number | null
          b2_airbus_a350: number | null
          b2_atr_42_72: number | null
          b2_boeing_737: number | null
          b2_boeing_777: number | null
          b2_boeing_787: number | null
          b2_bombardier_crj: number | null
          b2_embraer_e_jet: number | null
          b2_otros: number | null
          cat_a: boolean | null
          certificador: boolean | null
          cod_empleado_aena: string | null
          correo: string | null
          created_at: string
          estado: number | null
          external_id: string
          fecha_alta: string | null
          fecha_baja: string | null
          fecha_modificacion: string | null
          helper: boolean | null
          id: string
          id_chat: string | null
          legacy_id: number | null
          n_bac: string | null
          nombre: string
          raw_payload: Json
          source_system: string
          source_table: string
          synced_at: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          a_a320_family?: number | null
          a_airbus_a330?: number | null
          a_airbus_a350?: number | null
          a_atr_42_72?: number | null
          a_boeing_737?: number | null
          a_boeing_777?: number | null
          a_boeing_787?: number | null
          a_bombardier_crj?: number | null
          a_embraer_e_jet?: number | null
          a_otros?: number | null
          b1?: boolean | null
          b1_a320_family?: number | null
          b1_airbus_a330?: number | null
          b1_airbus_a350?: number | null
          b1_atr_42_72?: number | null
          b1_boeing_737?: number | null
          b1_boeing_777?: number | null
          b1_boeing_787?: number | null
          b1_bombardier_crj?: number | null
          b1_embraer_e_jet?: number | null
          b1_otros?: number | null
          b2?: boolean | null
          b2_a320_family?: number | null
          b2_airbus_a330?: number | null
          b2_airbus_a350?: number | null
          b2_atr_42_72?: number | null
          b2_boeing_737?: number | null
          b2_boeing_777?: number | null
          b2_boeing_787?: number | null
          b2_bombardier_crj?: number | null
          b2_embraer_e_jet?: number | null
          b2_otros?: number | null
          cat_a?: boolean | null
          certificador?: boolean | null
          cod_empleado_aena?: string | null
          correo?: string | null
          created_at?: string
          estado?: number | null
          external_id: string
          fecha_alta?: string | null
          fecha_baja?: string | null
          fecha_modificacion?: string | null
          helper?: boolean | null
          id?: string
          id_chat?: string | null
          legacy_id?: number | null
          n_bac?: string | null
          nombre: string
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          a_a320_family?: number | null
          a_airbus_a330?: number | null
          a_airbus_a350?: number | null
          a_atr_42_72?: number | null
          a_boeing_737?: number | null
          a_boeing_777?: number | null
          a_boeing_787?: number | null
          a_bombardier_crj?: number | null
          a_embraer_e_jet?: number | null
          a_otros?: number | null
          b1?: boolean | null
          b1_a320_family?: number | null
          b1_airbus_a330?: number | null
          b1_airbus_a350?: number | null
          b1_atr_42_72?: number | null
          b1_boeing_737?: number | null
          b1_boeing_777?: number | null
          b1_boeing_787?: number | null
          b1_bombardier_crj?: number | null
          b1_embraer_e_jet?: number | null
          b1_otros?: number | null
          b2?: boolean | null
          b2_a320_family?: number | null
          b2_airbus_a330?: number | null
          b2_airbus_a350?: number | null
          b2_atr_42_72?: number | null
          b2_boeing_737?: number | null
          b2_boeing_777?: number | null
          b2_boeing_787?: number | null
          b2_bombardier_crj?: number | null
          b2_embraer_e_jet?: number | null
          b2_otros?: number | null
          cat_a?: boolean | null
          certificador?: boolean | null
          cod_empleado_aena?: string | null
          correo?: string | null
          created_at?: string
          estado?: number | null
          external_id?: string
          fecha_alta?: string | null
          fecha_baja?: string | null
          fecha_modificacion?: string | null
          helper?: boolean | null
          id?: string
          id_chat?: string | null
          legacy_id?: number | null
          n_bac?: string | null
          nombre?: string
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      broki_planner_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          person_id: string | null
          position: number
          updated_at: string
          worker_text: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          person_id?: string | null
          position: number
          updated_at?: string
          worker_text?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          person_id?: string | null
          position?: number
          updated_at?: string
          worker_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broki_planner_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "broki_planner_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_planner_group_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_planner_groups: {
        Row: {
          aerolinea: string | null
          aircraft_id: string | null
          created_at: string
          destino: string | null
          external_id: string
          fecha_modificacion: string | null
          hora_llegada: string | null
          hora_salida: string | null
          id: string
          id_avion: string | null
          legacy_id: number | null
          modelo: string | null
          raw_payload: Json
          responsable: string | null
          responsible_person_id: string | null
          source_system: string
          source_table: string
          synced_at: string | null
          updated_at: string
          vehicle_asset_id: string | null
          vehiculo: string | null
        }
        Insert: {
          aerolinea?: string | null
          aircraft_id?: string | null
          created_at?: string
          destino?: string | null
          external_id: string
          fecha_modificacion?: string | null
          hora_llegada?: string | null
          hora_salida?: string | null
          id?: string
          id_avion?: string | null
          legacy_id?: number | null
          modelo?: string | null
          raw_payload?: Json
          responsable?: string | null
          responsible_person_id?: string | null
          source_system?: string
          source_table?: string
          synced_at?: string | null
          updated_at?: string
          vehicle_asset_id?: string | null
          vehiculo?: string | null
        }
        Update: {
          aerolinea?: string | null
          aircraft_id?: string | null
          created_at?: string
          destino?: string | null
          external_id?: string
          fecha_modificacion?: string | null
          hora_llegada?: string | null
          hora_salida?: string | null
          id?: string
          id_avion?: string | null
          legacy_id?: number | null
          modelo?: string | null
          raw_payload?: Json
          responsable?: string | null
          responsible_person_id?: string | null
          source_system?: string
          source_table?: string
          synced_at?: string | null
          updated_at?: string
          vehicle_asset_id?: string | null
          vehiculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broki_planner_groups_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "broki_aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_planner_groups_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_planner_groups_vehicle_asset_id_fkey"
            columns: ["vehicle_asset_id"]
            isOneToOne: false
            referencedRelation: "broki_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_planner_tasks: {
        Row: {
          aircraft_id: string | null
          codigo: string | null
          created_at: string
          descripcion: string | null
          estado: number | null
          external_id: string
          fecha: string | null
          fecha_modificacion: string | null
          group_id: string | null
          id: string
          legacy_id: number | null
          matricula_avion: string | null
          notas: string | null
          prioridad: string | null
          raw_payload: Json
          source_system: string
          source_table: string
          synced_at: string | null
          tipo_tarea: string | null
          updated_at: string
        }
        Insert: {
          aircraft_id?: string | null
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: number | null
          external_id: string
          fecha?: string | null
          fecha_modificacion?: string | null
          group_id?: string | null
          id?: string
          legacy_id?: number | null
          matricula_avion?: string | null
          notas?: string | null
          prioridad?: string | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          tipo_tarea?: string | null
          updated_at?: string
        }
        Update: {
          aircraft_id?: string | null
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: number | null
          external_id?: string
          fecha?: string | null
          fecha_modificacion?: string | null
          group_id?: string | null
          id?: string
          legacy_id?: number | null
          matricula_avion?: string | null
          notas?: string | null
          prioridad?: string | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          tipo_tarea?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broki_planner_tasks_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "broki_aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_planner_tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "broki_planner_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_sync_errors: {
        Row: {
          created_at: string
          entity: string
          error_message: string
          external_id: string | null
          id: string
          raw_payload: Json
          source_system: string
          source_table: string | null
          sync_run_id: string | null
        }
        Insert: {
          created_at?: string
          entity: string
          error_message: string
          external_id?: string | null
          id?: string
          raw_payload?: Json
          source_system?: string
          source_table?: string | null
          sync_run_id?: string | null
        }
        Update: {
          created_at?: string
          entity?: string
          error_message?: string
          external_id?: string | null
          id?: string
          raw_payload?: Json
          source_system?: string
          source_table?: string | null
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broki_sync_errors_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "broki_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_sync_runs: {
        Row: {
          entity: string
          error_count: number
          fetched_count: number
          finished_at: string | null
          id: string
          inserted_count: number
          metadata: Json
          source_system: string
          source_table: string | null
          started_at: string
          status: string
          sync_mode: string
          updated_count: number
        }
        Insert: {
          entity: string
          error_count?: number
          fetched_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          metadata?: Json
          source_system?: string
          source_table?: string | null
          started_at?: string
          status?: string
          sync_mode?: string
          updated_count?: number
        }
        Update: {
          entity?: string
          error_count?: number
          fetched_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          metadata?: Json
          source_system?: string
          source_table?: string | null
          started_at?: string
          status?: string
          sync_mode?: string
          updated_count?: number
        }
        Relationships: []
      }
      broki_tooling_catalog: {
        Row: {
          bac_bact: string | null
          codigo: string | null
          created_at: string
          descripcion: string | null
          estado: string | null
          external_id: string
          familia: string | null
          id: string
          legacy_id: number | null
          raw_payload: Json
          source_system: string
          source_table: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          bac_bact?: string | null
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          external_id: string
          familia?: string | null
          id?: string
          legacy_id?: number | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          bac_bact?: string | null
          codigo?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          external_id?: string
          familia?: string | null
          id?: string
          legacy_id?: number | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      broki_tooling_movements: {
        Row: {
          aircraft_id: string | null
          avion: string | null
          bac_bact: string | null
          complete_in: string | null
          complete_out: string | null
          created_at: string
          date_in: string | null
          date_out: string | null
          descripcion: string | null
          external_id: string
          id: string
          legacy_id: number | null
          raw_payload: Json
          remarks: string | null
          source_system: string
          source_table: string
          synced_at: string | null
          tma_in: string | null
          tma_in_person_id: string | null
          tma_out: string | null
          tma_out_person_id: string | null
          tool_id: string | null
          updated_at: string
        }
        Insert: {
          aircraft_id?: string | null
          avion?: string | null
          bac_bact?: string | null
          complete_in?: string | null
          complete_out?: string | null
          created_at?: string
          date_in?: string | null
          date_out?: string | null
          descripcion?: string | null
          external_id: string
          id?: string
          legacy_id?: number | null
          raw_payload?: Json
          remarks?: string | null
          source_system?: string
          source_table?: string
          synced_at?: string | null
          tma_in?: string | null
          tma_in_person_id?: string | null
          tma_out?: string | null
          tma_out_person_id?: string | null
          tool_id?: string | null
          updated_at?: string
        }
        Update: {
          aircraft_id?: string | null
          avion?: string | null
          bac_bact?: string | null
          complete_in?: string | null
          complete_out?: string | null
          created_at?: string
          date_in?: string | null
          date_out?: string | null
          descripcion?: string | null
          external_id?: string
          id?: string
          legacy_id?: number | null
          raw_payload?: Json
          remarks?: string | null
          source_system?: string
          source_table?: string
          synced_at?: string | null
          tma_in?: string | null
          tma_in_person_id?: string | null
          tma_out?: string | null
          tma_out_person_id?: string | null
          tool_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broki_tooling_movements_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "broki_aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_tooling_movements_tma_in_person_id_fkey"
            columns: ["tma_in_person_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_tooling_movements_tma_out_person_id_fkey"
            columns: ["tma_out_person_id"]
            isOneToOne: false
            referencedRelation: "broki_personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broki_tooling_movements_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "broki_tooling_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      broki_unknown_contacts: {
        Row: {
          created_at: string
          external_id: string
          fecha_modificacion: string | null
          first_name: string | null
          id: string
          id_chat: string | null
          last_name: string | null
          legacy_id: number | null
          mensaje: string | null
          raw_payload: Json
          source_system: string
          source_table: string
          synced_at: string | null
          telefono: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id: string
          fecha_modificacion?: string | null
          first_name?: string | null
          id?: string
          id_chat?: string | null
          last_name?: string | null
          legacy_id?: number | null
          mensaje?: string | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          telefono: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string
          fecha_modificacion?: string | null
          first_name?: string | null
          id?: string
          id_chat?: string | null
          last_name?: string | null
          legacy_id?: number | null
          mensaje?: string | null
          raw_payload?: Json
          source_system?: string
          source_table?: string
          synced_at?: string | null
          telefono?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

