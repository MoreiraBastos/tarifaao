-- Tarifa.ao MVP Supabase schema
-- Run this in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.route_searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  app_version text not null default 'v1.01-beta',
  pickup_label text not null,
  destination_label text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  distance_km numeric(8, 2),
  time_bucket text not null check (time_bucket in ('agora', 'manha', 'pico', 'noite')),
  sort_mode text not null default 'price',
  results_count integer not null default 0,
  source text not null default 'web_mvp'
);

create table if not exists public.fare_contributions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  app_version text not null default 'v1.01-beta',
  route_key text not null,
  app_name text not null,
  pickup_label text not null,
  destination_label text not null,
  distance_km numeric(8, 2),
  time_bucket text not null check (time_bucket in ('agora', 'manha', 'pico', 'noite')),
  price_kz integer not null check (price_kz > 0),
  eta_text text,
  note text,
  source text not null default 'local'
);

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  app_version text not null default 'v1.01-beta',
  feedback_type text not null default 'general',
  message text not null,
  context jsonb not null default '{}'::jsonb
);

create index if not exists route_searches_created_at_idx on public.route_searches (created_at desc);
create index if not exists route_searches_device_id_idx on public.route_searches (device_id);
create index if not exists fare_contributions_route_key_idx on public.fare_contributions (route_key);
create index if not exists fare_contributions_app_name_idx on public.fare_contributions (app_name);
create index if not exists fare_contributions_created_at_idx on public.fare_contributions (created_at desc);
create index if not exists user_feedback_created_at_idx on public.user_feedback (created_at desc);

alter table public.route_searches enable row level security;
alter table public.fare_contributions enable row level security;
alter table public.user_feedback enable row level security;

drop policy if exists "Public can insert route searches" on public.route_searches;
create policy "Public can insert route searches"
  on public.route_searches
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can insert fare contributions" on public.fare_contributions;
create policy "Public can insert fare contributions"
  on public.fare_contributions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can insert feedback" on public.user_feedback;
create policy "Public can insert feedback"
  on public.user_feedback
  for insert
  to anon, authenticated
  with check (true);

grant usage on schema public to anon, authenticated;
grant insert on public.route_searches to anon, authenticated;
grant insert on public.fare_contributions to anon, authenticated;
grant insert on public.user_feedback to anon, authenticated;
