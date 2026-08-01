-- Idempotency keys for service-to-service mutations.
-- Prevents duplicate writes from retried requests (n8n, Next server, smoke).
-- Not applied to browser user requests (they don't send Idempotency-Key).

create table if not exists public.broki_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  service_id text not null,
  idempotency_key text not null,
  request_path text not null,
  request_hash text not null,
  response_status smallint not null,
  -- Response body stored capped to 4KB; never stores secrets or PDFs.
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint broki_idempotency_keys_unique unique (service_id, idempotency_key)
);

create index if not exists broki_idempotency_expires_idx
  on public.broki_idempotency_keys (expires_at);

-- RLS: only service_role can write; authenticated can never see idempotency keys.
alter table public.broki_idempotency_keys enable row level security;
-- No public select policy — service role bypasses RLS.

-- Audit events: add actor_type and actor_service_id columns for richer tracing.
-- ponytail: storing in metadata jsonb is enough for now; add columns if query perf needed.
alter table public.broki_audit_events
  add column if not exists actor_type text check (actor_type in ('user', 'service')) default null,
  add column if not exists actor_service_id text default null;
