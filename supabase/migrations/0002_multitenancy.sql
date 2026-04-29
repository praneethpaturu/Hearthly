-- ─────────────────────────────────────────────────────────────────────
-- Hearthly D1 — multi-tenant ULB foundation
--
-- Adds a tenants table + tenant_id columns to every existing entity so
-- one Hearthly install can serve multiple ULBs (Greater Hyderabad,
-- Warangal, Khammam, etc.) with isolated data and operator allow-lists.
--
-- Additive + idempotent: existing rows backfill to a default
-- 'default-ts' (Telangana state-wide demo) tenant so nothing breaks.
-- Re-runnable in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────

-- ── Tenants (one row per ULB / civic body) ────────────────────────────
create table if not exists tenants (
  id            text primary key,
  name          text not null,
  short_name    text,
  state         text not null default 'TS',          -- ISO/state code: TS, AP, KA…
  category      text not null default 'ULB',         -- ULB | STATE | DEMO
  population    bigint,
  ward_count    int,
  contact_email text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists tenants_state_idx on tenants (state);

-- ── tenant_id on existing tables (additive — backfill 'default-ts') ──

-- operators
alter table operators
  add column if not exists tenant_id text not null default 'default-ts';
create index if not exists operators_tenant_idx on operators (tenant_id);

-- heartbeats
alter table heartbeats
  add column if not exists tenant_id text not null default 'default-ts';
create index if not exists heartbeats_tenant_idx on heartbeats (tenant_id);

-- audit_log
alter table audit_log
  add column if not exists tenant_id text not null default 'default-ts';
create index if not exists audit_log_tenant_idx on audit_log (tenant_id);

-- ── New tenant-scoped tables ─────────────────────────────────────────

-- Wards (each tenant has many)
create table if not exists wards (
  id          text primary key,
  tenant_id   text not null references tenants(id) on delete cascade,
  name        text not null,
  city_name   text,
  population  int,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);
create index if not exists wards_tenant_idx on wards (tenant_id);

-- Grievances (the citizen-side core artifact; today in-memory only)
create table if not exists grievances (
  id           bigserial primary key,
  tenant_id    text not null references tenants(id) on delete cascade,
  ward_id      text references wards(id) on delete set null,
  citizen_phone text,                                 -- nullable; anon allowed
  channel      text not null default 'web',           -- web | whatsapp | ivr | walk-in
  category     text,                                  -- pothole | sanitation | water | streetlight | drain | other
  severity     text default 'normal',                 -- normal | high | critical
  title        text,
  description  text,
  language     text default 'en',                     -- en | te | hi | ur
  media_url    text,
  lat          double precision,
  lng          double precision,
  status       text not null default 'open',          -- open | assigned | resolved | rejected
  assigned_to  text,                                  -- operator/worker id
  sla_due_at   timestamptz,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists grievances_tenant_idx     on grievances (tenant_id);
create index if not exists grievances_status_idx     on grievances (tenant_id, status);
create index if not exists grievances_ward_idx       on grievances (tenant_id, ward_id);
create index if not exists grievances_created_at_idx on grievances (tenant_id, created_at desc);

-- Touch updated_at on every grievance UPDATE
create or replace function grievances_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists grievances_updated_at on grievances;
create trigger grievances_updated_at
  before update on grievances
  for each row execute function grievances_touch_updated_at();

-- ── RLS on the new tables (service-role bypasses; default-deny anon) ──
alter table tenants    enable row level security;
alter table wards      enable row level security;
alter table grievances enable row level security;

-- Tenants list is anon-readable so a future tenant-picker UI can render
-- the brand strip without a server round-trip. Sensitive fields (email,
-- counts) are not anon-restricted yet — revisit when the UI lands.
drop policy if exists tenants_anon_read on tenants;
create policy tenants_anon_read on tenants for select to anon using (is_active);

-- Wards: anon-readable. Used by citizen ward-picker.
drop policy if exists wards_anon_read on wards;
create policy wards_anon_read on wards for select to anon using (true);

-- Grievances: anon can INSERT (citizen submission). Reads are service-
-- role only so an anon client can't leak another citizen's report.
drop policy if exists grievances_anon_insert on grievances;
create policy grievances_anon_insert on grievances for insert to anon with check (true);

-- ── Seed: one demo tenant + 3 sample ULBs + ward seed ────────────────
insert into tenants (id, name, short_name, state, category, population, ward_count) values
  ('default-ts', 'Telangana Statewide (Demo)', 'TS Demo', 'TS', 'STATE',  35200000, 600),
  ('ghmc',       'Greater Hyderabad Municipal Corporation', 'GHMC', 'TS', 'ULB', 10100000, 150),
  ('wmc',        'Warangal Municipal Corporation',          'WMC',  'TS', 'ULB',   811000,  66),
  ('kmc-tg',     'Khammam Municipal Corporation',           'KMC',  'TS', 'ULB',   313504,  60)
on conflict (id) do update set
  name        = excluded.name,
  short_name  = excluded.short_name,
  state       = excluded.state,
  category    = excluded.category,
  population  = excluded.population,
  ward_count  = excluded.ward_count;

-- Seed ward sample (so future ward-picker UI has something to render)
insert into wards (id, tenant_id, name, city_name, population, lat, lng) values
  ('ghmc-w1',  'ghmc',  'Madhapur',         'Hyderabad', 90000,  17.4480, 78.3915),
  ('ghmc-w2',  'ghmc',  'Banjara Hills',    'Hyderabad', 60000,  17.4126, 78.4471),
  ('ghmc-w3',  'ghmc',  'Begumpet',         'Hyderabad', 55000,  17.4429, 78.4636),
  ('ghmc-w4',  'ghmc',  'Kukatpally',       'Hyderabad', 130000, 17.4849, 78.4138),
  ('wmc-w1',   'wmc',   'Hanamkonda',       'Warangal',  70000,  18.0091, 79.5805),
  ('wmc-w2',   'wmc',   'Kazipet',          'Warangal',  45000,  18.0200, 79.5500),
  ('kmc-w1',   'kmc-tg','Khammam Central',  'Khammam',   58000,  17.2473, 80.1514)
on conflict (id) do update set
  tenant_id  = excluded.tenant_id,
  name       = excluded.name,
  city_name  = excluded.city_name,
  population = excluded.population,
  lat        = excluded.lat,
  lng        = excluded.lng;

-- Tag seed operators to GHMC + 'default-ts' so multi-tenant login works
-- end-to-end. (op1..op5 from migration 0001.)
update operators set tenant_id = 'ghmc' where id in ('op1','op2','op3');
update operators set tenant_id = 'default-ts' where id in ('op4','op5');
