-- Fase 10.1: canonical destinations for tooling operational fields.
-- vehiculo → MAP to descripcion (no new column). msn/motor already exist.

alter table public.broki_tooling_catalog
  add column if not exists tipo text,
  add column if not exists supplier text,
  add column if not exists manufacturer text,
  add column if not exists part_number text,
  add column if not exists serial_number text,
  add column if not exists ubicacion_habitual text;

comment on column public.broki_tooling_catalog.tipo is 'Legacy tooling.tipo / tipo_tool';
comment on column public.broki_tooling_catalog.supplier is 'Legacy tooling.supplier';
comment on column public.broki_tooling_catalog.manufacturer is 'Legacy tooling.manufacturer';
