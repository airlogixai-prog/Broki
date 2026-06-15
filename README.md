# Broki

## Estructura

```
Broki/
├── supabase/   # CLI, migraciones y base de datos local
└── web/        # Next.js + cliente Supabase
```

## Inicio rápido

```bash
npm install
npm install --prefix web
cp web/.env.example web/.env.local   # credenciales locales por defecto
npm run supabase:start               # opcional: base de datos local
npm run dev
```

Abre http://localhost:3000.

## Supabase (local)

Requisitos: [Docker](https://docs.docker.com/get-docker/) y Node.js.

```bash
npm install              # instala Supabase CLI en el repo
npm run supabase:start   # levanta Postgres, Auth, Storage, Studio…
npm run supabase:status  # URLs y claves locales
```

Studio local: http://127.0.0.1:54323

Si el puerto ya está en uso por otro proyecto Supabase:

```bash
supabase stop --project-id <otro-proyecto>
# o ajusta los puertos en supabase/config.toml
```

### Migraciones

```bash
npm run db:reset   # aplica migraciones + seed
npm run db:types   # regenera tipos TypeScript en web/
```

La migración inicial crea la tabla `profiles` vinculada a `auth.users` con RLS.

### Producción

Crea un proyecto en [supabase.com](https://supabase.com), copia URL y anon key a `web/.env.local`, y enlaza el remoto:

```bash
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```
