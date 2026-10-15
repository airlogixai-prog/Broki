# Fase 4 — Matriz atributo legacy → canónico

- migration_id: `fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c`
- atributos clasificados: **224**
- counts: {"CANONICAL_DIRECT":146,"CANONICAL_RENAMED":5,"CANONICAL_DERIVED":0,"RELATION_NORMALIZED":10,"RAW_ONLY_INTENTIONAL":47,"DEPRECATED_APPROVED":4,"MISSING":6,"UNKNOWN":6}
- gate PASS? **NO** (MISSING=6, UNKNOWN=6)

| Fuente | Campo legacy | Destino | Transformación | Cobertura | Clasificación | Test |
|---|---|---|---|---:|---|---|
| nitro_stock | id | legacy_id/external_id |  | 1 | CANONICAL_DIRECT | none |
| nitro_stock | createdAt | broki_nitro_stock |  | 1 | UNKNOWN | none |
| nitro_stock | ubicacion | broki_nitro_stock.ubicacion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_nitro_stock |
| nitro_stock | updatedAt | broki_nitro_stock |  | 1 | UNKNOWN | none |
| nitro_stock | cantida_de_botellas_llenas | broki_nitro_stock.botellas_llenas | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_nitro_stock |
| nitro_stock | cantidad_de_botellas_vacias | broki_nitro_stock.botellas_vacias | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_nitro_stock |
| aviones | id | broki_aircraft.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_aircraft |
| aviones | msn | broki_aircraft.msn | column exists post-20260802210000; normalize still coalesce into matricula | 0 | MISSING | none |
| aviones | motor | broki_aircraft.motor | column exists; normalize coalesce into modelo | 0 | MISSING | none |
| aviones | modelo | broki_aircraft.modelo | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_aircraft |
| aviones | compania | broki_aircraft |  | 1 | UNKNOWN | none |
| aviones | matricula | broki_aircraft.matricula | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_aircraft |
| aviones | fecha_modificacion | raw_payload |  | 1 | RAW_ONLY_INTENTIONAL | none |
| furgonetas | id | broki_assets.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | avion | broki_assets.avion_text | direct jtxt/jint | 0.353 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | notas | broki_assets.notas | direct jtxt/jint | 0.059 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | estado | broki_assets.estado | direct jtxt/jint | 0.824 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | plazas | broki_assets.plazas | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | familia | broki_assets.familia | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | parking | broki_assets.parking | direct jtxt/jint | 0.412 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | vehiculo | no assets.vehiculo column | UI mapper fallback f.vehiculo from raw/API shape; assets select * has no vehiculo | 1 | MISSING | none |
| furgonetas | matricula | broki_assets.matricula | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | combustible | broki_assets.combustible | direct jtxt/jint | 0.294 | CANONICAL_DIRECT | broki_normalize_assets |
| furgonetas | trabajadores | broki_assets.current_worker_text | normalizer only reads trabajador (singular) | 0.824 | MISSING | none |
| furgonetas | identificador | broki_assets.legacy_id | alias → legacy_id | 1 | CANONICAL_RENAMED | broki_normalize_assets |
| grupo_trabajo | id | broki_planner_groups.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | modelo | broki_planner_groups.modelo | direct jtxt/jint | 0.633 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | destino | broki_planner_groups.destino | direct jtxt/jint | 0 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | id_avion | broki_planner_groups.id_avion | direct jtxt/jint | 0.633 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | vehiculo | broki_planner_groups.vehiculo | direct jtxt/jint | 0.633 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | aerolinea | broki_planner_groups.aerolinea | direct jtxt/jint | 0.633 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | hora_salida | broki_planner_groups.hora_salida | direct jtxt/jint | 0.633 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | responsable | broki_planner_groups.responsable | direct jtxt/jint | 0.633 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | hora_llegada | broki_planner_groups.hora_llegada | direct jtxt/jint | 0.167 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| grupo_trabajo | trabajador_1 | broki_planner_group_members.worker_text | trabajador_N → members | 0.633 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_2 | broki_planner_group_members.worker_text | trabajador_N → members | 0.567 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_3 | broki_planner_group_members.worker_text | trabajador_N → members | 0.467 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_4 | broki_planner_group_members.worker_text | trabajador_N → members | 0.2 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_5 | broki_planner_group_members.worker_text | trabajador_N → members | 0.2 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_6 | broki_planner_group_members.worker_text | trabajador_N → members | 0.133 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_7 | broki_planner_group_members.worker_text | trabajador_N → members | 0.133 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_8 | broki_planner_group_members.worker_text | trabajador_N → members | 0.033 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_9 | broki_planner_group_members.worker_text | trabajador_N → members | 0 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | trabajador_10 | broki_planner_group_members.worker_text | trabajador_N → members | 0 | RELATION_NORMALIZED | normalize_planner_groups |
| grupo_trabajo | fecha_modificacion | broki_planner_groups.fecha_modificacion | direct jtxt/jint | 0.367 | CANONICAL_DIRECT | broki_normalize_planner_groups |
| gse | id | broki_assets.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| gse | brk | identifier/BRK | often in identificador; brk may stay raw | 1 | MISSING | none |
| gse | avion | broki_assets.avion_text | direct jtxt/jint | 0.091 | CANONICAL_DIRECT | broki_normalize_assets |
| gse | notas | broki_assets.notas | direct jtxt/jint | 0.117 | CANONICAL_DIRECT | broki_normalize_assets |
| gse | estado | broki_assets.estado | direct jtxt/jint | 0.909 | CANONICAL_DIRECT | broki_normalize_assets |
| gse | familia | broki_assets.familia | direct jtxt/jint | 0.727 | CANONICAL_DIRECT | broki_normalize_assets |
| gse | parking | broki_assets.parking | direct jtxt/jint | 0.052 | CANONICAL_DIRECT | broki_normalize_assets |
| gse | combustible | broki_assets.combustible | direct jtxt/jint | 0.026 | CANONICAL_DIRECT | broki_normalize_assets |
| gse | descripcion | broki_assets.descripcion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| gse | trabajadores | broki_assets.current_worker_text | normalizer only reads trabajador (singular) | 0.364 | MISSING | none |
| gse | ubicacion_habitual | broki_assets.ubicacion_habitual | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| incidencias | id | broki_incidents.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_incidents |
| incidencias | estado | broki_incidents.estado | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_incidents |
| incidencias | id_objeto | broki_incidents.id_objeto | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_incidents |
| incidencias | trabajador | broki_incidents.trabajador_text | direct jtxt/jint | 0.706 | CANONICAL_DIRECT | broki_normalize_incidents |
| incidencias | descripcion | broki_incidents.descripcion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_incidents |
| incidencias | id_incidencia | broki_incidents.legacy_id | alias → legacy_id | 1 | CANONICAL_RENAMED | broki_normalize_incidents |
| incidencias | fecha_modificacion | broki_incidents.fecha_modificacion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_incidents |
| inventario | id | broki_assets.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | avion | broki_assets.avion_text | direct jtxt/jint | 0.085 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | notas | broki_assets.notas | direct jtxt/jint | 0 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | adblue | broki_assets.adblue | direct jtxt/jint | 0.553 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | estado | broki_assets.estado | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | plazas | broki_assets.plazas | direct jtxt/jint | 0.777 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | familia | broki_assets.familia | direct jtxt/jint | 0.777 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | parking | broki_assets.parking | direct jtxt/jint | 0.106 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | matricula | broki_assets.matricula | direct jtxt/jint | 0.755 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | trabajador | broki_assets.current_worker_text | direct jtxt/jint | 0 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | combustible | broki_assets.combustible | direct jtxt/jint | 0.713 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | descripcion | broki_assets.descripcion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | nitrogeno_1 | broki_assets.nitrogeno_1 | direct jtxt/jint | 0.745 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | nitrogeno_2 | broki_assets.nitrogeno_2 | direct jtxt/jint | 0.745 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | nitrogeno_3 | broki_assets.nitrogeno_3 | direct jtxt/jint | 0.745 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | nitrogeno_4 | broki_assets.nitrogeno_4 | direct jtxt/jint | 0.745 | CANONICAL_DIRECT | broki_normalize_assets |
| inventario | identificador | broki_assets.legacy_id | alias → legacy_id | 1 | CANONICAL_RENAMED | broki_normalize_assets |
| inventario | ubicacion_habitual | broki_assets.ubicacion_habitual | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_assets |
| n8n_chat_histories | id | broki_chat_histories.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_chat_histories |
| n8n_chat_histories | message | broki_chat_histories.content | alias → content | 1 | CANONICAL_RENAMED | broki_normalize_chat_histories |
| n8n_chat_histories | session_id | broki_chat_histories.session_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_chat_histories |
| no_existe_telefono | id | broki_unknown_contacts.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_unknown_contacts |
| no_existe_telefono | id_chat | broki_unknown_contacts.id_chat | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_unknown_contacts |
| no_existe_telefono | mensaje | broki_unknown_contacts.mensaje | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_unknown_contacts |
| no_existe_telefono | telefono | broki_unknown_contacts.telefono | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_unknown_contacts |
| no_existe_telefono | last_name | broki_unknown_contacts.last_name | direct jtxt/jint | 0.273 | CANONICAL_DIRECT | broki_normalize_unknown_contacts |
| no_existe_telefono | first_name | broki_unknown_contacts.first_name | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_unknown_contacts |
| no_existe_telefono | fecha_modificacion | broki_unknown_contacts.fecha_modificacion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_unknown_contacts |
| personal | b1 | broki_personnel.b1 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2 | broki_personnel.b2 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | id | broki_personnel.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | cat_a | broki_personnel.cat_a | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | n_bac | broki_personnel.n_bac | direct jtxt/jint | 0.486 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | correo | broki_personnel.correo | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | estado | broki_personnel.estado | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | helper | broki_personnel.helper | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | nombre | broki_personnel.nombre | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_otros | broki_personnel.a_otros | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | id_chat | broki_personnel.id_chat | direct jtxt/jint | 0 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_otros | broki_personnel.b1_otros | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_otros | broki_personnel.b2_otros | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | telefono | broki_personnel.telefono | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | fecha_alta | broki_personnel.fecha_alta | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | fecha_baja | broki_personnel.fecha_baja | direct jtxt/jint | 0 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_atr_42_72 | broki_personnel.a_atr_42_72 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_boeing_737 | broki_personnel.a_boeing_737 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_boeing_777 | broki_personnel.a_boeing_777 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_boeing_787 | broki_personnel.a_boeing_787 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_atr_42_72 | broki_personnel.b1_atr_42_72 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_atr_42_72 | broki_personnel.b2_atr_42_72 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | certificador | broki_personnel.certificador | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_a320_family | broki_personnel.a_a320_family | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_airbus_a330 | broki_personnel.a_airbus_a330 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_airbus_a350 | broki_personnel.a_airbus_a350 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_boeing_737 | broki_personnel.b1_boeing_737 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_boeing_777 | broki_personnel.b1_boeing_777 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_boeing_787 | broki_personnel.b1_boeing_787 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_boeing_737 | broki_personnel.b2_boeing_737 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_boeing_777 | broki_personnel.b2_boeing_777 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_boeing_787 | broki_personnel.b2_boeing_787 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_a320_family | broki_personnel.b1_a320_family | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_airbus_a330 | broki_personnel.b1_airbus_a330 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_airbus_a350 | broki_personnel.b1_airbus_a350 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_a320_family | broki_personnel.b2_a320_family | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_airbus_a330 | broki_personnel.b2_airbus_a330 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_airbus_a350 | broki_personnel.b2_airbus_a350 | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_embraer_e_jet | broki_personnel.a_embraer_e_jet | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | a_bombardier_crj | broki_personnel.a_bombardier_crj | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_embraer_e_jet | broki_personnel.b1_embraer_e_jet | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_embraer_e_jet | broki_personnel.b2_embraer_e_jet | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b1_bombardier_crj | broki_personnel.b1_bombardier_crj | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | b2_bombardier_crj | broki_personnel.b2_bombardier_crj | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | cod_empleado_aena | broki_personnel.cod_empleado_aena | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| personal | fecha_modificacion | broki_personnel.fecha_modificacion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_personnel |
| registro_comunicaciones | id | broki_communications.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_communications |
| registro_comunicaciones | id_chat | broki_communications.id_chat | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_communications |
| registro_comunicaciones | telefono | broki_communications.telefono | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_communications |
| registro_comunicaciones | mensaje_in | broki_communications.mensaje_in | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_communications |
| registro_comunicaciones | respondido | broki_communications.respondido | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_communications |
| registro_comunicaciones | mensaje_out | broki_communications.mensaje_out | direct jtxt/jint | 0.997 | CANONICAL_DIRECT | broki_normalize_communications |
| registro_comunicaciones | fecha_mensaje_in | broki_communications.fecha_mensaje_in | direct jtxt/jint | 0.998 | CANONICAL_DIRECT | broki_normalize_communications |
| registro_comunicaciones | fecha_mensaje_out | broki_communications.fecha_mensaje_out | direct jtxt/jint | 0.997 | CANONICAL_DIRECT | broki_normalize_communications |
| tareas | id | broki_planner_tasks.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | fecha | broki_planner_tasks.fecha | direct jtxt/jint | 0.982 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | notas | broki_planner_tasks.notas | direct jtxt/jint | 0.158 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | codigo | broki_planner_tasks.codigo | direct jtxt/jint | 0.982 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | estado | broki_planner_tasks.estado | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | prioridad | broki_planner_tasks.prioridad | direct jtxt/jint | 0.982 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | tipo_tarea | broki_planner_tasks.tipo_tarea | direct jtxt/jint | 0.982 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | descripcion | broki_planner_tasks.descripcion | direct jtxt/jint | 0.982 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | matricula_avion | broki_planner_tasks.matricula_avion | direct jtxt/jint | 0.982 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | id_grupo_trabajo | broki_planner_tasks.grupo_trabajo_external_id | direct jtxt/jint | 0.509 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tareas | fecha_modificacion | broki_planner_tasks.fecha_modificacion | direct jtxt/jint | 0.526 | CANONICAL_DIRECT | broki_normalize_planner_tasks |
| tool_control | id | broki_tooling_movements.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | avion | broki_tooling_movements.avion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | tma_in | broki_tooling_movements.tma_in | direct jtxt/jint | 0.667 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | date_in | broki_tooling_movements.date_in | direct jtxt/jint | 0.667 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | remarks | broki_tooling_movements.remarks | direct jtxt/jint | 0 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | tma_out | broki_tooling_movements.tma_out | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | bac_bact | broki_tooling_movements.bac_bact | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | date_out | broki_tooling_movements.date_out | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | complete_in | broki_tooling_movements.complete_in | direct jtxt/jint | 0.667 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | descripcion | broki_tooling_movements.descripcion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tool_control | complete_out | broki_tooling_movements.complete_out | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_movements |
| tooling | id | broki_tooling_catalog.legacy_id | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_catalog |
| tooling | tipo | broki_tooling_catalog |  | 0.997 | UNKNOWN | none |
| tooling | avion | broki_tooling_catalog |  | 0 | DEPRECATED_APPROVED | none |
| tooling | notas | raw_payload only | documented raw_only | 0.134 | RAW_ONLY_INTENTIONAL | none |
| tooling | rango | raw_payload only | documented raw_only | 0.456 | RAW_ONLY_INTENTIONAL | none |
| tooling | estado | broki_tooling_catalog.estado | direct jtxt/jint | 0.997 | CANONICAL_DIRECT | broki_normalize_tooling_catalog |
| tooling | parking | broki_tooling_catalog |  | 0 | DEPRECATED_APPROVED | none |
| tooling | supplier | broki_tooling_catalog |  | 1 | UNKNOWN | none |
| tooling | tipo_tool | raw_payload only | documented raw_only | 1 | RAW_ONLY_INTENTIONAL | none |
| tooling | trabajador | broki_tooling_catalog |  | 0 | DEPRECATED_APPROVED | none |
| tooling | descripcion | broki_tooling_catalog.descripcion | direct jtxt/jint | 1 | CANONICAL_DIRECT | broki_normalize_tooling_catalog |
| tooling | part_number | raw_payload only | documented raw_only | 1 | RAW_ONLY_INTENTIONAL | none |
| tooling | manufacturer | broki_tooling_catalog |  | 0.253 | UNKNOWN | none |
| tooling | identificador | broki_tooling_catalog.bac_bact | alias → bac_bact | 1 | CANONICAL_RENAMED | broki_normalize_tooling_catalog |
| tooling | serial_number | raw_payload only | documented raw_only | 0.962 | RAW_ONLY_INTENTIONAL | none |
| tooling | fecha_calibracion | raw_payload |  | 0 | DEPRECATED_APPROVED | none |
| tooling | ubicacion_habitual | raw_payload only | documented raw_only | 1 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | id | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | avion | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | notas | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.063 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | estado | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | plazas | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | parking | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.938 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | vehiculo | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | matricula | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | combustible | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | trabajadores | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.063 | RAW_ONLY_INTENTIONAL | none |
| public__furgonetas | identificador | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__gse | id | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__gse | brk | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__gse | avion | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.057 | RAW_ONLY_INTENTIONAL | none |
| public__gse | notas | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.075 | RAW_ONLY_INTENTIONAL | none |
| public__gse | estado | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__gse | parking | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.038 | RAW_ONLY_INTENTIONAL | none |
| public__gse | combustible | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0 | RAW_ONLY_INTENTIONAL | none |
| public__gse | descripcion | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.906 | RAW_ONLY_INTENTIONAL | none |
| public__gse | trabajadores | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.038 | RAW_ONLY_INTENTIONAL | none |
| public__gse | ubicacion_habitual | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.943 | RAW_ONLY_INTENTIONAL | none |
| public__personal | id | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__personal | alias | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0 | RAW_ONLY_INTENTIONAL | none |
| public__personal | airbus | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.337 | RAW_ONLY_INTENTIONAL | none |
| public__personal | boeing | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.14 | RAW_ONLY_INTENTIONAL | none |
| public__personal | correo | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.07 | RAW_ONLY_INTENTIONAL | none |
| public__personal | nombre | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__personal | id_chat | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0 | RAW_ONLY_INTENTIONAL | none |
| public__personal | telefono | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__personal | registrado | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__personal | cod_empleado | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0.965 | RAW_ONLY_INTENTIONAL | none |
| public__personal | certificacion | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__registro_comunicaciones | id | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__registro_comunicaciones | fecha | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0 | RAW_ONLY_INTENTIONAL | none |
| public__registro_comunicaciones | id_chat | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__registro_comunicaciones | telefono | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__registro_comunicaciones | mensaje_in | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__registro_comunicaciones | respondido | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |
| public__registro_comunicaciones | mensaje_out | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 0 | RAW_ONLY_INTENTIONAL | none |
| public__registro_comunicaciones | fecha_modificacion | RAW_ONLY (public mirror / dual-source) | not normalized from public__* | 1 | RAW_ONLY_INTENTIONAL | none |

## Gaps P0 (MISSING/UNKNOWN)

- `n8n_datatable|n8n|nitro_stock`.`createdAt` → UNKNOWN: broki_nitro_stock
- `n8n_datatable|n8n|nitro_stock`.`updatedAt` → UNKNOWN: broki_nitro_stock
- `n8n_postgres_pro|pro|aviones`.`msn` → MISSING: column exists post-20260802210000; normalize still coalesce into matricula
- `n8n_postgres_pro|pro|aviones`.`motor` → MISSING: column exists; normalize coalesce into modelo
- `n8n_postgres_pro|pro|aviones`.`compania` → UNKNOWN: broki_aircraft
- `n8n_postgres_pro|pro|furgonetas`.`vehiculo` → MISSING: UI mapper fallback f.vehiculo from raw/API shape; assets select * has no vehiculo
- `n8n_postgres_pro|pro|furgonetas`.`trabajadores` → MISSING: normalizer only reads trabajador (singular)
- `n8n_postgres_pro|pro|gse`.`brk` → MISSING: often in identificador; brk may stay raw
- `n8n_postgres_pro|pro|gse`.`trabajadores` → MISSING: normalizer only reads trabajador (singular)
- `n8n_postgres_pro|pro|tooling`.`tipo` → UNKNOWN: broki_tooling_catalog
- `n8n_postgres_pro|pro|tooling`.`supplier` → UNKNOWN: broki_tooling_catalog
- `n8n_postgres_pro|pro|tooling`.`manufacturer` → UNKNOWN: broki_tooling_catalog

Fuente de contrato base: `config/broki/legacy-field-map.json`. Clasificación auditoría: `config/broki/legacy-field-map.audit.json`.
