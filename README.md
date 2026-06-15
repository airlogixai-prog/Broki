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
npm run functions:secrets   # N8N_BASE_URL para las Edge Functions
npm run functions:deploy    # despliega todas las functions
```

En Vercel, configura las mismas variables de entorno de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) apuntando al proyecto remoto, no a `127.0.0.1`.

#### Vercel (monorepo)

La app Next.js está en `web/`. Si Vercel despliega desde la raíz del repo verás **404: NOT_FOUND**.

1. **Project Settings → General → Root Directory** → `web`
2. **Redeploy** el último deployment
3. **Environment Variables** (Production):
   - `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`
4. **Supabase → Authentication → URL Configuration**:
   - Site URL: `https://broki-iota.vercel.app`
   - Redirect URLs: `https://broki-iota.vercel.app/**`
