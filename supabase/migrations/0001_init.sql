-- ─────────────────────────────────────────────────────────────────────
-- Hearthly CMCC — Supabase schema
--
-- Run once in the Supabase SQL Editor (https://supabase.com/dashboard
-- → Project → SQL → New query → paste this → Run). Idempotent so it
-- can be re-applied safely.
-- ─────────────────────────────────────────────────────────────────────

-- ── Operators (replaces _lib.js OPERATORS Map) ────────────────────────
create table if not exists operators (
  id          text primary key,
  phone       text unique not null,
  name        text,
  op_role     text,
  created_at  timestamptz not null default now()
);

-- ── Mobile-device heartbeats (replaces in-memory Map) ─────────────────
create table if not exists heartbeats (
  device_id   text primary key,
  state       jsonb,
  ip          text,
  ua          text,
  last_seen   timestamptz not null default now()
);
create index if not exists heartbeats_last_seen_idx on heartbeats (last_seen desc);

-- ── Operator audit log (replaces in-memory array) ────────────────────
create table if not exists audit_log (
  id          bigserial primary key,
  actor       text,
  action      text,
  target      text,
  when_at     timestamptz not null default now()
);
create index if not exists audit_log_when_idx on audit_log (when_at desc);

-- ── Row-Level Security ──────────────────────────────────────────────
-- All tables are accessed via the service-role key from the Vercel
-- functions, which bypasses RLS by design. We still enable RLS so any
-- accidental anon-key reads return empty rather than leaking data.
alter table operators  enable row level security;
alter table heartbeats enable row level security;
alter table audit_log  enable row level security;

-- Allow anon clients to read the operator allow-list (phone numbers
-- only, no PII beyond name + role) so the login page's demo-chip
-- helper can populate without a server round-trip.
drop policy if exists operators_anon_read on operators;
create policy operators_anon_read on operators for select to anon using (true);

-- Heartbeats: anon clients post their own heartbeat (deviceId is the
-- credential, same contract as the Express server). Network reads are
-- service-role only.
drop policy if exists heartbeats_anon_upsert on heartbeats;
create policy heartbeats_anon_upsert on heartbeats for insert to anon with check (true);
drop policy if exists heartbeats_anon_update on heartbeats;
create policy heartbeats_anon_update on heartbeats for update to anon using (true) with check (true);

-- audit_log: service-role only (no anon policies; default-deny applies).

-- ── Seed operators ───────────────────────────────────────────────────
insert into operators (id, phone, name, op_role) values
  ('op1', '+919999900010', 'Priya Iyer',   'NOC Lead'),
  ('op2', '+919999900011', 'Sandeep Rao',  'NOC Operator'),
  ('op3', '+919999900012', 'Rakhi Menon',  'NOC Operator'),
  ('op4', '+919999900013', 'Faizan Ahmed', 'On-Call SRE'),
  ('op5', '+919999900014', 'Akhila Reddy', 'Compliance')
on conflict (id) do update set
  phone = excluded.phone,
  name = excluded.name,
  op_role = excluded.op_role;
