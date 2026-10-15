# Fase 3 — Inventario de atributos legacy

- migration_id: `fc7cbf8b-7c2c-489f-bd85-72fbd38eca4c`
- atributos únicos (unión keys): **130**
- fuentes: 20

## Por fuente

| Fuente | Filas | Atributos |
|---|---:|---:|
| n8n_datatable|n8n|nitro_stock | 2 | 6 |
| n8n_postgres_pro|pro|aviones | 18 | 7 |
| n8n_postgres_pro|pro|furgonetas | 17 | 12 |
| n8n_postgres_pro|pro|grupo_trabajo | 30 | 20 |
| n8n_postgres_pro|pro|gse | 77 | 11 |
| n8n_postgres_pro|pro|historial | 0 | 0 |
| n8n_postgres_pro|pro|incidencias | 34 | 7 |
| n8n_postgres_pro|pro|inventario | 94 | 18 |
| n8n_postgres_pro|pro|n8n_chat_histories | 6906 | 3 |
| n8n_postgres_pro|pro|no_existe_telefono | 22 | 7 |
| n8n_postgres_pro|pro|personal | 70 | 46 |
| n8n_postgres_pro|pro|registro_comunicaciones | 1476 | 8 |
| n8n_postgres_pro|pro|tareas | 57 | 11 |
| n8n_postgres_pro|pro|tool_control | 3 | 11 |
| n8n_postgres_pro|pro|tooling | 344 | 17 |
| n8n_postgres_public|public|public__furgonetas | 16 | 11 |
| n8n_postgres_public|public|public__gse | 53 | 10 |
| n8n_postgres_public|public|public__personal | 86 | 11 |
| n8n_postgres_public|public|public__registro_comunicaciones | 11 | 8 |
| n8n_postgres_public|public|public__tool_control | 0 | 0 |

## Watchlist (variantes)

- **cantida_de_botellas_llenas**: n8n_datatable|n8n|nitro_stock::cantida_de_botellas_llenas
- **cantidad_de_botellas_vacias**: n8n_datatable|n8n|nitro_stock::cantidad_de_botellas_vacias
- **msn**: n8n_postgres_pro|pro|aviones::msn
- **motor**: n8n_postgres_pro|pro|aviones::motor
- **modelo**: n8n_postgres_pro|pro|aviones::modelo, n8n_postgres_pro|pro|grupo_trabajo::modelo
- **matricula**: n8n_postgres_pro|pro|aviones::matricula, n8n_postgres_pro|pro|furgonetas::matricula, n8n_postgres_pro|pro|inventario::matricula, n8n_postgres_pro|pro|tareas::matricula_avion, n8n_postgres_public|public|public__furgonetas::matricula
- **fecha**: n8n_postgres_pro|pro|aviones::fecha_modificacion, n8n_postgres_pro|pro|grupo_trabajo::fecha_modificacion, n8n_postgres_pro|pro|incidencias::fecha_modificacion, n8n_postgres_pro|pro|no_existe_telefono::fecha_modificacion, n8n_postgres_pro|pro|personal::fecha_alta, n8n_postgres_pro|pro|personal::fecha_baja, n8n_postgres_pro|pro|personal::fecha_modificacion, n8n_postgres_pro|pro|registro_comunicaciones::fecha_mensaje_in, n8n_postgres_pro|pro|registro_comunicaciones::fecha_mensaje_out, n8n_postgres_pro|pro|tareas::fecha, n8n_postgres_pro|pro|tareas::fecha_modificacion, n8n_postgres_pro|pro|tooling::fecha_calibracion, n8n_postgres_public|public|public__registro_comunicaciones::fecha, n8n_postgres_public|public|public__registro_comunicaciones::fecha_modificacion
- **estado**: n8n_postgres_pro|pro|furgonetas::estado, n8n_postgres_pro|pro|gse::estado, n8n_postgres_pro|pro|incidencias::estado, n8n_postgres_pro|pro|inventario::estado, n8n_postgres_pro|pro|personal::estado, n8n_postgres_pro|pro|tareas::estado, n8n_postgres_pro|pro|tooling::estado, n8n_postgres_public|public|public__furgonetas::estado, n8n_postgres_public|public|public__gse::estado
- **vehiculo**: n8n_postgres_pro|pro|furgonetas::vehiculo, n8n_postgres_pro|pro|grupo_trabajo::vehiculo, n8n_postgres_public|public|public__furgonetas::vehiculo
- **trabajador**: n8n_postgres_pro|pro|furgonetas::trabajadores, n8n_postgres_pro|pro|grupo_trabajo::trabajador_1, n8n_postgres_pro|pro|grupo_trabajo::trabajador_2, n8n_postgres_pro|pro|grupo_trabajo::trabajador_3, n8n_postgres_pro|pro|grupo_trabajo::trabajador_4, n8n_postgres_pro|pro|grupo_trabajo::trabajador_5, n8n_postgres_pro|pro|grupo_trabajo::trabajador_6, n8n_postgres_pro|pro|grupo_trabajo::trabajador_7, n8n_postgres_pro|pro|grupo_trabajo::trabajador_8, n8n_postgres_pro|pro|grupo_trabajo::trabajador_9, n8n_postgres_pro|pro|grupo_trabajo::trabajador_10, n8n_postgres_pro|pro|gse::trabajadores, n8n_postgres_pro|pro|incidencias::trabajador, n8n_postgres_pro|pro|inventario::trabajador, n8n_postgres_pro|pro|tooling::trabajador, n8n_postgres_public|public|public__furgonetas::trabajadores, n8n_postgres_public|public|public__gse::trabajadores
- **trabajadores**: n8n_postgres_pro|pro|furgonetas::trabajadores, n8n_postgres_pro|pro|gse::trabajadores, n8n_postgres_public|public|public__furgonetas::trabajadores, n8n_postgres_public|public|public__gse::trabajadores
- **aerolinea**: n8n_postgres_pro|pro|grupo_trabajo::aerolinea
- **hora_salida**: n8n_postgres_pro|pro|grupo_trabajo::hora_salida
- **hora_llegada**: n8n_postgres_pro|pro|grupo_trabajo::hora_llegada
- **descripcion**: n8n_postgres_pro|pro|gse::descripcion, n8n_postgres_pro|pro|incidencias::descripcion, n8n_postgres_pro|pro|inventario::descripcion, n8n_postgres_pro|pro|tareas::descripcion, n8n_postgres_pro|pro|tool_control::descripcion, n8n_postgres_pro|pro|tooling::descripcion, n8n_postgres_public|public|public__gse::descripcion
- **correo**: n8n_postgres_pro|pro|personal::correo, n8n_postgres_public|public|public__personal::correo
- **cod_empleado**: n8n_postgres_pro|pro|personal::cod_empleado_aena, n8n_postgres_public|public|public__personal::cod_empleado
- **cod_empleado_aena**: n8n_postgres_pro|pro|personal::cod_empleado_aena
- **id_grupo_trabajo**: n8n_postgres_pro|pro|tareas::id_grupo_trabajo
- **registrado**: n8n_postgres_public|public|public__personal::registrado
- **certificacion**: n8n_postgres_public|public|public__personal::certificacion

Artefacto: `config/broki/generated-legacy-field-inventory.json`
