-- Public marketing leads (contact + demo). No PII in realtime publication.

create table if not exists public.broki_marketing_leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null check (lead_type in ('contact', 'demo')),
  name text not null,
  email text not null,
  message text,
  company text,
  interest text,
  privacy_accepted boolean not null default false,
  source_ip text,
  user_agent text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists broki_marketing_leads_type_idx on public.broki_marketing_leads (lead_type, created_at desc);
create index if not exists broki_marketing_leads_email_idx on public.broki_marketing_leads (lower(email));

alter table public.broki_marketing_leads enable row level security;
