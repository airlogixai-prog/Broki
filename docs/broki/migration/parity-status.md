# Matriz de paridad — legacy → Next

Fuente de verdad comportamiento: `public_html/broki.html`  
Destino: `web/src/app/broki/**` + Edge Functions + RPC/Realtime.

## Leyenda (estados finales)

| Estado | Significado |
|--------|-------------|
| `FULL_PASS` | Comportamiento + contrato + validación + estados + test + evidencia |
| `INTENTIONAL_IMPROVEMENT` | Legacy documentado + motivo + aprobación explícita + test nuevo |
| `BLOCKED` | Gap conocido; no se declara migrado |
| `UNAUDITED` | Seed Fase 0 — pendiente de auditoría profunda |

`PARTIAL` no es estado final.

## Rutas / áreas

| Área | Legacy | Next ruta | Estado | Evidencia |
|------|--------|-----------|--------|-----------|
| Dashboard home | tab inicio | `/broki` | UNAUDITED | — |
| Furgonetas | tab | `/broki/furgonetas` | UNAUDITED | — |
| GSE | tab | `/broki/gse` | UNAUDITED | — |
| Aviones | tab | `/broki/aviones` | UNAUDITED | — |
| Incidencias | tab | `/broki/incidencias` | UNAUDITED | — |
| Mapa | tab | `/broki/mapa` | UNAUDITED | — |
| Analytics | tab | `/broki/analytics` | UNAUDITED | — |
| Planner | tab | `/broki/planner` | UNAUDITED | — |
| Roster / horario | tab | `/broki/roster` | UNAUDITED | — |
| Fleet | — | `/broki/fleet` | UNAUDITED | — |
| Stock N₂ | tab | `/broki/stock` | UNAUDITED | — |
| Tooling | tab | `/broki/tooling` | UNAUDITED | — |
| Auth / PIN planner | PIN `7378` en HTML | Supabase Auth | UNAUDITED | mejora candidata |
| E2E gate / login QA | — | Playwright `qa@broki.test` | BLOCKED | login no sale de `/login` |
| Polling 30s | `fetchData` | hooks + realtime | UNAUDITED | — |
| Relevos | localStorage | EF `relays` | UNAUDITED | — |
| Temas ×6 | localStorage | preferencias | UNAUDITED | — |
| Notificaciones browser | Notification API | in-app bell | UNAUDITED | — |
| WhatsApp inbound | n8n | `broki-whatsapp-inbound` | UNAUDITED | fuera de dashboard |
| Import datos legacy | n8n + PG `pro` | `broki-import-batch` | UNAUDITED | ver data-contract-matrix |

Actualizar fila → estado final solo con checklist completo (regla 11).
