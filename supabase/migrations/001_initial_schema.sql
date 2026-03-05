-- ─────────────────────────────────────────────────────────────────────────────
-- TitraHealth Initial Schema
-- Apply via: Supabase Dashboard → SQL Editor, or Supabase MCP apply_migration
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable uuid generation
create extension if not exists "pgcrypto";

-- ─── Weight Logs ─────────────────────────────────────────────────────────────
create table if not exists weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  weight_kg  numeric(6,2) not null,
  notes      text,
  logged_at  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table weight_logs enable row level security;
create policy "Users manage own weight logs"
  on weight_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Side Effect Logs ────────────────────────────────────────────────────────
create table if not exists side_effect_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  type       text not null,
  severity   smallint not null check (severity between 1 and 5),
  notes      text,
  logged_at  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table side_effect_logs enable row level security;
create policy "Users manage own side effect logs"
  on side_effect_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Injection Logs ──────────────────────────────────────────────────────────
create table if not exists injection_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  dose_mg    numeric(4,2) not null,
  site       text not null,
  notes      text,
  logged_at  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table injection_logs enable row level security;
create policy "Users manage own injection logs"
  on injection_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Activity Logs ───────────────────────────────────────────────────────────
create table if not exists activity_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  type          text not null,
  duration_min  integer not null,
  intensity     text check (intensity in ('low', 'moderate', 'high')),
  logged_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table activity_logs enable row level security;
create policy "Users manage own activity logs"
  on activity_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Food Entries ────────────────────────────────────────────────────────────
create table if not exists food_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  name          text not null,
  calories      numeric(7,1) not null default 0,
  protein_g     numeric(6,1) not null default 0,
  carbs_g       numeric(6,1) not null default 0,
  fat_g         numeric(6,1) not null default 0,
  fiber_g       numeric(6,1) not null default 0,
  serving_size  text,
  input_method  text not null check (input_method in ('search', 'barcode', 'photo', 'describe', 'ai')),
  logged_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table food_entries enable row level security;
create policy "Users manage own food entries"
  on food_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Indexes for common queries ───────────────────────────────────────────────
create index if not exists weight_logs_user_date     on weight_logs(user_id, logged_at desc);
create index if not exists side_effect_logs_user_date on side_effect_logs(user_id, logged_at desc);
create index if not exists injection_logs_user_date   on injection_logs(user_id, logged_at desc);
create index if not exists activity_logs_user_date    on activity_logs(user_id, logged_at desc);
create index if not exists food_entries_user_date     on food_entries(user_id, logged_at desc);
